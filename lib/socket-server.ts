import { Server as IOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Socket } from 'socket.io';
import { redisService } from '@/lib/redis';
import { generateRoomId } from '@/lib/video-utils';
import { Room, User, ChatMessage, SocketEvents } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface SocketData {
  userId: string;
  userName: string;
  roomId?: string;
}

let io: IOServer | undefined;

export function initSocketIO(httpServer: HTTPServer): IOServer {
  if (io) {
    return io;
  }

  io = new IOServer(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS?.split(',') || []
          : ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/socket/io',
  });

  io.on('connection', (socket: Socket<SocketEvents, SocketEvents, object, SocketData>) => {
    console.log('User connected:', socket.id);

    // Create room
    socket.on('create-room', async ({ hostName }) => {
      try {
        // Validate hostName format
        if (!hostName || typeof hostName !== 'string') {
          socket.emit('room-error', { error: 'Invalid name provided' });
          return;
        }

        const trimmedName = hostName.trim();
        if (trimmedName.length < 2) {
          socket.emit('room-error', { error: 'Name must be at least 2 characters long' });
          return;
        }

        if (trimmedName.length > 50) {
          socket.emit('room-error', { error: 'Name must be 50 characters or less' });
          return;
        }

        if (!/^[a-zA-Z0-9\s\-_.!?]+$/.test(trimmedName)) {
          socket.emit('room-error', {
            error:
              'Name can only contain letters, numbers, spaces, and basic punctuation (- _ . ! ?)',
          });
          return;
        }

        const roomId = generateRoomId();
        const userId = uuidv4();

        const user: User = {
          id: userId,
          name: trimmedName,
          isHost: true,
          joinedAt: new Date(),
        };

        const room: Room = {
          id: roomId,
          hostId: userId,
          hostName: trimmedName,
          hostToken: uuidv4(), // Store the host token in the room
          videoType: null,
          videoState: {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            lastUpdateTime: Date.now(),
          },
          users: [user],
          createdAt: new Date(),
        };

        await redisService.createRoom(room);

        socket.data.userId = userId;
        socket.data.userName = trimmedName;
        socket.data.roomId = roomId;

        await socket.join(roomId);

        // Emit both events for consistency
        socket.emit('room-created', { roomId, room, hostToken: room.hostToken });
        socket.emit('room-joined', { room, user });
        console.log(`Room ${roomId} created by ${trimmedName} with token ${room.hostToken}`);
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('room-error', { error: 'Failed to create room' });
      }
    });

    // Join room
    socket.on('join-room', async ({ roomId, userName, hostToken }) => {
      console.log(
        `🔐 Join request: roomId=${roomId}, userName=${userName}, hostToken=${hostToken ? 'PROVIDED' : 'MISSING'}, socketId=${socket.id}`
      );

      // Check if this exact socket is already in this room
      if (socket.rooms.has(roomId)) {
        console.log(
          `🔄 Socket ${socket.id} already in room ${roomId}, checking if this is the room creator...`
        );

        // If socket is already in room, this might be the room creator or a guest who already joined
        // Check if they have valid credentials for this room
        const room = await redisService.getRoom(roomId);
        if (room) {
          const existingUser = room.users.find(u => u.name === userName?.trim());

          if (existingUser) {
            // If this is the host with valid token, emit join success
            if (existingUser.isHost && hostToken === room.hostToken) {
              console.log(`✅ Room creator ${userName} already in room, emitting join success`);
              socket.emit('room-joined', { room, user: existingUser });
              return;
            }

            // If this is a guest who already joined, also emit join success
            if (!existingUser.isHost) {
              console.log(`✅ Guest ${userName} already in room, emitting join success`);
              socket.emit('room-joined', { room, user: existingUser });
              return;
            }
          }
        }

        // Otherwise, ignore the duplicate attempt
        console.log(`🔄 Ignoring duplicate join attempt for unknown user`);
        return;
      }

      try {
        // Validate userName format
        if (!userName || typeof userName !== 'string') {
          socket.emit('room-error', { error: 'Invalid name provided' });
          return;
        }

        const trimmedName = userName.trim();
        if (trimmedName.length < 2) {
          socket.emit('room-error', { error: 'Name must be at least 2 characters long' });
          return;
        }

        if (trimmedName.length > 50) {
          socket.emit('room-error', { error: 'Name must be 50 characters or less' });
          return;
        }

        if (!/^[a-zA-Z0-9\s\-_.!?]+$/.test(trimmedName)) {
          socket.emit('room-error', {
            error:
              'Name can only contain letters, numbers, spaces, and basic punctuation (- _ . ! ?)',
          });
          return;
        }

        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        // Check if this user is already in the room (by name)
        const existingUser = room.users.find(u => u.name === trimmedName);
        if (existingUser) {
          // If existing user is the host, verify they have the correct token
          if (existingUser.isHost) {
            if (!hostToken || hostToken !== room.hostToken) {
              console.log(
                `Host impersonation attempt by ${trimmedName} - existing user but invalid token`
              );
              socket.emit('room-error', {
                error: 'Invalid host credentials. Only the room creator can join as host.',
              });
              return;
            }
            console.log(`Host ${trimmedName} verified with valid token (existing user)`);

            // User already exists in room and is authenticated, update their socket data
            socket.data.userId = existingUser.id;
            socket.data.userName = existingUser.name;
            socket.data.roomId = roomId;

            await socket.join(roomId);
            console.log(
              `${trimmedName} rejoined room ${roomId} (existing user, isHost: ${existingUser.isHost})`
            );
            socket.emit('room-joined', { room, user: existingUser });
            return;
          } else {
            // Guest trying to join with name of existing user (not allowed)
            console.log(`Duplicate name attempt by ${trimmedName} - name already taken by guest`);
            socket.emit('room-error', {
              error: `The name "${trimmedName}" is already taken in this room. Please choose a different name.`,
            });
            return;
          }
        }

        // Check if this user is trying to be the host
        const isClaimingHost = room.hostName === trimmedName;
        let isRoomHost = false;

        console.log(
          `Join attempt: user="${trimmedName}", isClaimingHost=${isClaimingHost}, hostToken="${hostToken}", roomHostToken="${room.hostToken}"`
        );

        if (isClaimingHost) {
          // Verify they have the correct host token
          if (hostToken && hostToken === room.hostToken) {
            isRoomHost = true;
            console.log(`Host ${trimmedName} verified with valid token`);
          } else {
            console.log(`Host impersonation attempt by ${trimmedName} - invalid or missing token`);
            socket.emit('room-error', {
              error: 'Invalid host credentials. Only the room creator can join as host.',
            });
            return;
          }
        } else {
          // Not claiming to be host, but check if name conflicts with host name
          if (room.hostName === trimmedName) {
            console.log(`Guest attempting to use host name: ${trimmedName}`);
            socket.emit('room-error', {
              error: `The name "${trimmedName}" is reserved for the room host. Please choose a different name.`,
            });
            return;
          }
        }

        // Create new user
        const userId = uuidv4();
        const user: User = {
          id: userId,
          name: trimmedName,
          isHost: isRoomHost,
          joinedAt: new Date(),
        };

        // If this is the host rejoining, update the room's hostId
        if (isRoomHost) {
          room.hostId = userId;
          await redisService.updateRoom(roomId, room);
          console.log(`Host ${trimmedName} rejoining room ${roomId} with new user ID`);
        }

        await redisService.addUserToRoom(roomId, user);
        const updatedRoom = await redisService.getRoom(roomId);

        socket.data.userId = userId;
        socket.data.userName = trimmedName;
        socket.data.roomId = roomId;

        await socket.join(roomId);

        socket.emit('room-joined', { room: updatedRoom!, user });
        socket.to(roomId).emit('user-joined', { user });

        console.log(`${trimmedName} joined room ${roomId} as ${isRoomHost ? 'host' : 'guest'}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('room-error', { error: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('leave-room', async ({ roomId }) => {
      await handleLeaveRoom(socket, roomId);
    });

    // Set video URL
    socket.on('set-video', async ({ roomId, videoUrl }) => {
      try {
        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        const currentUser = room.users.find(u => u.id === socket.data.userId);
        if (!currentUser?.isHost) {
          socket.emit('error', { error: 'Only hosts can set the video' });
          return;
        }

        // Determine video type - match in-memory version exactly
        let videoType: 'youtube' | 'mp4' | 'm3u8' = 'mp4';
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
          videoType = 'youtube';
        } else if (
          videoUrl.match(/\.(m3u8)(\?.*)?$/i) ||
          videoUrl.includes('/live/') ||
          videoUrl.includes('.m3u8')
        ) {
          videoType = 'm3u8';
        }

        await redisService.setVideoUrl(roomId, videoUrl, videoType);

        io!.to(roomId).emit('video-set', { videoUrl, videoType });
        console.log(`Video set in room ${roomId}: ${videoUrl}`);
      } catch (error) {
        console.error('Error setting video:', error);
        socket.emit('error', { error: 'Failed to set video' });
      }
    });

    // Play video
    socket.on('play-video', async ({ roomId, currentTime }) => {
      try {
        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        const currentUser = room.users.find(u => u.id === socket.data.userId);
        if (!currentUser?.isHost) {
          socket.emit('error', { error: 'Only hosts can control the video' });
          return;
        }

        const videoState = {
          isPlaying: true,
          currentTime,
          duration: room.videoState.duration,
          lastUpdateTime: Date.now(),
        };

        await redisService.updateVideoState(roomId, videoState);

        socket.to(roomId).emit('video-played', {
          currentTime,
          timestamp: videoState.lastUpdateTime,
        });

        console.log(`Video played in room ${roomId} at ${currentTime}s`);
      } catch (error) {
        console.error('Error playing video:', error);
        socket.emit('error', { error: 'Failed to play video' });
      }
    });

    // Pause video
    socket.on('pause-video', async ({ roomId, currentTime }) => {
      try {
        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        const currentUser = room.users.find(u => u.id === socket.data.userId);
        if (!currentUser?.isHost) {
          socket.emit('error', { error: 'Only hosts can control the video' });
          return;
        }

        const videoState = {
          isPlaying: false,
          currentTime,
          duration: room.videoState.duration,
          lastUpdateTime: Date.now(),
        };

        await redisService.updateVideoState(roomId, videoState);

        socket.to(roomId).emit('video-paused', {
          currentTime,
          timestamp: videoState.lastUpdateTime,
        });

        console.log(`Video paused in room ${roomId} at ${currentTime}s`);
      } catch (error) {
        console.error('Error pausing video:', error);
        socket.emit('error', { error: 'Failed to pause video' });
      }
    });

    // Seek video
    socket.on('seek-video', async ({ roomId, currentTime }) => {
      try {
        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        const currentUser = room.users.find(u => u.id === socket.data.userId);
        if (!currentUser?.isHost) {
          socket.emit('error', { error: 'Only hosts can control the video' });
          return;
        }

        const videoState = {
          ...room.videoState,
          currentTime,
          lastUpdateTime: Date.now(),
        };

        await redisService.updateVideoState(roomId, videoState);

        socket.to(roomId).emit('video-seeked', {
          currentTime,
          timestamp: videoState.lastUpdateTime,
        });

        console.log(`Video seeked in room ${roomId} to ${currentTime}s`);
      } catch (error) {
        console.error('Error seeking video:', error);
        socket.emit('error', { error: 'Failed to seek video' });
      }
    });

    // Promote user to host
    socket.on('promote-host', async ({ roomId, userId }) => {
      try {
        if (!socket.data.userId) {
          socket.emit('error', { error: 'Not authenticated' });
          return;
        }

        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        const currentUser = room.users.find(u => u.id === socket.data.userId);
        if (!currentUser?.isHost) {
          socket.emit('error', { error: 'Only hosts can promote users' });
          return;
        }

        const targetUser = room.users.find(u => u.id === userId);
        if (!targetUser) {
          socket.emit('error', { error: 'User not found' });
          return;
        }

        if (targetUser.isHost) {
          socket.emit('error', { error: 'User is already a host' });
          return;
        }

        // Update user to host
        const updatedUsers = room.users.map(u => (u.id === userId ? { ...u, isHost: true } : u));
        const updatedRoom = { ...room, users: updatedUsers };
        await redisService.updateRoom(roomId, updatedRoom);

        io!.to(roomId).emit('user-promoted', { userId, userName: targetUser.name });

        console.log(`${targetUser.name} promoted to host in room ${roomId} by ${currentUser.name}`);
      } catch (error) {
        console.error('Error promoting user:', error);
        socket.emit('error', { error: 'Failed to promote user' });
      }
    });

    // Sync check for hosts
    socket.on('sync-check', async ({ roomId, currentTime, isPlaying, timestamp }) => {
      try {
        if (!socket.data.userId) {
          socket.emit('error', { error: 'Not authenticated' });
          return;
        }

        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        const currentUser = room.users.find(u => u.id === socket.data.userId);
        if (!currentUser?.isHost) {
          socket.emit('error', { error: 'Only hosts can send sync checks' });
          return;
        }

        // Broadcast sync update to all other users
        socket.to(roomId).emit('sync-update', { currentTime, isPlaying, timestamp });

        console.log(
          `Sync check sent in room ${roomId}: ${currentTime.toFixed(2)}s, playing: ${isPlaying}`
        );
      } catch (error) {
        console.error('Error sending sync check:', error);
        socket.emit('error', { error: 'Failed to send sync check' });
      }
    });

    // Typing indicators
    socket.on('typing-start', async ({ roomId }) => {
      try {
        if (!socket.data.userId || !socket.data.userName) {
          socket.emit('error', { error: 'Not authenticated' });
          return;
        }

        // Broadcast to all other users in the room that this user is typing
        socket.to(roomId).emit('user-typing', {
          userId: socket.data.userId,
          userName: socket.data.userName,
        });

        console.log(`${socket.data.userName} started typing in room ${roomId}`);
      } catch (error) {
        console.error('Error handling typing start:', error);
        socket.emit('error', { error: 'Failed to handle typing start' });
      }
    });

    socket.on('typing-stop', async ({ roomId }) => {
      try {
        if (!socket.data.userId) {
          socket.emit('error', { error: 'Not authenticated' });
          return;
        }

        // Broadcast to all other users in the room that this user stopped typing
        socket.to(roomId).emit('user-stopped-typing', {
          userId: socket.data.userId,
        });

        console.log(`${socket.data.userName} stopped typing in room ${roomId}`);
      } catch (error) {
        console.error('Error handling typing stop:', error);
        socket.emit('error', { error: 'Failed to handle typing stop' });
      }
    });

    // Send chat message
    socket.on('send-message', async ({ roomId, message }) => {
      try {
        if (!socket.data.userId || !socket.data.userName) {
          socket.emit('error', { error: 'Not authenticated' });
          return;
        }

        const chatMessage: ChatMessage = {
          id: uuidv4(),
          userId: socket.data.userId,
          userName: socket.data.userName,
          message: message.trim(),
          timestamp: new Date(),
          roomId,
        };

        await redisService.addChatMessage(roomId, chatMessage);

        io!.to(roomId).emit('new-message', { message: chatMessage });

        console.log(`Message sent in room ${roomId} by ${socket.data.userName}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { error: 'Failed to send message' });
      }
    });

    // Leave room
    socket.on('leave-room', async ({ roomId }) => {
      await handleLeaveRoom(socket, roomId, true); // true indicates manual leave
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);

      if (socket.data.roomId && socket.data.userId) {
        await handleLeaveRoom(socket, socket.data.roomId, false); // false indicates disconnect
      }
    });
  });

  return io;
}

async function handleLeaveRoom(
  socket: Socket<SocketEvents, SocketEvents, object, SocketData>,
  roomId: string,
  isManualLeave: boolean = false
) {
  try {
    if (!socket.data.userId) return;

    const room = await redisService.getRoom(roomId);
    if (!room) return;

    const leavingUser = room.users.find(u => u.id === socket.data.userId);
    if (!leavingUser) return;

    // Remove the leaving user from the room
    const updatedUsers = room.users.filter(u => u.id !== socket.data.userId);

    // Check if any hosts remain after this user leaves
    const remainingHosts = updatedUsers.filter(u => u.isHost);

    if (leavingUser.isHost && remainingHosts.length === 0) {
      // Last host is leaving, close the entire room and kick everyone out
      console.log(
        `🚪 Last host ${isManualLeave ? 'manually left' : 'disconnected from'} room ${roomId}, closing room and kicking all users`
      );

      // Notify all remaining users that the room is being closed
      socket.to(roomId).emit('room-error', {
        error: 'All hosts have left the room. Redirecting to home page...',
      });

      // Delete the room entirely
      await redisService.deleteRoom(roomId);

      console.log(`Room ${roomId} has been closed`);
    } else {
      // Update room with remaining users
      if (updatedUsers.length === 0) {
        // No users left at all, delete the room
        await redisService.deleteRoom(roomId);
      } else {
        // Update room with remaining users
        const updatedRoom = { ...room, users: updatedUsers };
        await redisService.updateRoom(roomId, updatedRoom);

        // Notify remaining users that this user left
        socket.to(roomId).emit('user-left', { userId: socket.data.userId });
      }
    }

    await socket.leave(roomId);
    console.log(`${socket.data.userName || 'User'} left room ${roomId}`);
  } catch (error) {
    console.error('Error leaving room:', error);
  }
}

export { io };
