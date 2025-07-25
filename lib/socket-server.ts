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
        const roomId = generateRoomId();
        const userId = uuidv4();

        const user: User = {
          id: userId,
          name: hostName,
          isHost: true,
          joinedAt: new Date(),
        };

        const room: Room = {
          id: roomId,
          hostId: userId,
          hostName,
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
        socket.data.userName = hostName;
        socket.data.roomId = roomId;

        await socket.join(roomId);

        // Emit both events for consistency
        socket.emit('room-created', { roomId, room });
        socket.emit('room-joined', { room, user });
        console.log(`Room ${roomId} created by ${hostName}`);
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('room-error', { error: 'Failed to create room' });
      }
    });

    // Join room
    socket.on('join-room', async ({ roomId, userName }) => {
      try {
        const room = await redisService.getRoom(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        // Check if this socket already has data for this room (room creator case)
        if (socket.data.roomId === roomId && socket.data.userId) {
          // User is already in the room (room creator), just send the room state
          const existingUser = room.users.find(u => u.id === socket.data.userId);
          if (existingUser) {
            socket.emit('room-joined', { room, user: existingUser });
            console.log(`${socket.data.userName} rejoined room ${roomId} (creator)`);
            return;
          }
        }

        const userId = uuidv4();
        const user: User = {
          id: userId,
          name: userName,
          isHost: false,
          joinedAt: new Date(),
        };

        await redisService.addUserToRoom(roomId, user);
        const updatedRoom = await redisService.getRoom(roomId);

        socket.data.userId = userId;
        socket.data.userName = userName;
        socket.data.roomId = roomId;

        await socket.join(roomId);

        socket.emit('room-joined', { room: updatedRoom!, user });
        socket.to(roomId).emit('user-joined', { user });

        console.log(`${userName} joined room ${roomId}`);
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
        if (!room || room.hostId !== socket.data.userId) {
          socket.emit('error', { error: 'Only the host can set the video' });
          return;
        }

        // Determine video type
        let videoType: 'youtube' | 'mp4' = 'mp4';
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
          videoType = 'youtube';
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
        if (!room || room.hostId !== socket.data.userId) {
          socket.emit('error', { error: 'Only the host can control the video' });
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
        if (!room || room.hostId !== socket.data.userId) {
          socket.emit('error', { error: 'Only the host can control the video' });
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
        if (!room || room.hostId !== socket.data.userId) {
          socket.emit('error', { error: 'Only the host can control the video' });
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

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);

      if (socket.data.roomId && socket.data.userId) {
        await handleLeaveRoom(socket, socket.data.roomId);
      }
    });
  });

  return io;
}

async function handleLeaveRoom(
  socket: Socket<SocketEvents, SocketEvents, object, SocketData>,
  roomId: string
) {
  try {
    if (socket.data.userId) {
      await redisService.removeUserFromRoom(roomId, socket.data.userId);
      socket.to(roomId).emit('user-left', { userId: socket.data.userId });
      await socket.leave(roomId);

      console.log(`${socket.data.userName || 'User'} left room ${roomId}`);
    }
  } catch (error) {
    console.error('Error leaving room:', error);
  }
}

export { io };
