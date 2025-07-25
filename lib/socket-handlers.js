// In-memory storage for development (replace with Redis in production!!??)
const rooms = new Map();
const users = new Map();

function setupSocketHandlers(io) {
  io.on('connection', socket => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ hostName }) => {
      console.log(`🏠 Creating room for host: ${hostName}`);
      try {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const hostToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        const userId = socket.id;

        const user = {
          id: userId,
          name: hostName,
          isHost: true,
          joinedAt: new Date(),
        };

        const room = {
          id: roomId,
          hostId: userId,
          hostName,
          hostToken, // Add unique host token
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

        rooms.set(roomId, room);
        users.set(userId, { ...user, roomId });

        socket.join(roomId);
        socket.emit('room-created', { roomId, hostToken });

        console.log(`Room ${roomId} created by ${hostName} with token ${hostToken}`);
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('room-error', { error: 'Failed to create room' });
      }
    });

    socket.on('join-room', ({ roomId, userName, hostToken }) => {
      console.log(
        `🔐 Join request: roomId=${roomId}, userName=${userName}, hostToken=${hostToken ? 'PROVIDED' : 'MISSING'}`
      );
      try {
        const room = rooms.get(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        // Check if this user is already in the room (by name)
        const existingUser = room.users.find(u => u.name === userName);
        if (existingUser) {
          // If existing user is the host, verify they have the correct token
          if (existingUser.isHost) {
            if (!hostToken || hostToken !== room.hostToken) {
              console.log(
                `Host impersonation attempt by ${userName} - existing user but invalid token`
              );
              socket.emit('room-error', {
                error: 'Invalid host credentials. Only the room creator can join as host.',
              });
              return;
            }
            console.log(`Host ${userName} verified with valid token (existing user)`);
          }

          // User already exists in room and is authenticated, update their socket data
          const userId = socket.id;

          // Update the existing user's ID to the new socket ID
          existingUser.id = userId;
          users.set(userId, { ...existingUser, roomId });

          socket.join(roomId);
          socket.emit('room-joined', { room, user: existingUser });
          console.log(
            `${userName} rejoined room ${roomId} (existing user, isHost: ${existingUser.isHost})`
          );
          return;
        }

        // Check if this user is trying to be the host
        const isClaimingHost = room.hostName === userName;
        let isRoomHost = false;

        console.log(
          `Join attempt: user="${userName}", isClaimingHost=${isClaimingHost}, hostToken="${hostToken}", roomHostToken="${room.hostToken}"`
        );
        console.log(`Room data:`, { hostName: room.hostName, hostToken: room.hostToken });

        if (isClaimingHost) {
          // Verify they have the correct host token
          if (hostToken && hostToken === room.hostToken) {
            isRoomHost = true;
            console.log(`Host ${userName} verified with valid token`);
          } else {
            console.log(`Host impersonation attempt by ${userName} - invalid or missing token`);
            socket.emit('room-error', {
              error: 'Invalid host credentials. Only the room creator can join as host.',
            });
            return;
          }
        }

        const userId = socket.id;
        const user = {
          id: userId,
          name: userName,
          isHost: isRoomHost,
          joinedAt: new Date(),
        };

        // If this is the host rejoining, update the room's hostId
        if (isRoomHost) {
          room.hostId = userId;
          console.log(`Host ${userName} rejoining room ${roomId} with new user ID`);
        }

        // Remove user if already exists (rejoin case)
        room.users = room.users.filter(u => u.id !== userId);
        room.users.push(user);

        users.set(userId, { ...user, roomId });

        socket.join(roomId);
        socket.emit('room-joined', { room, user });
        socket.to(roomId).emit('user-joined', { user });

        console.log(`${userName} joined room ${roomId} as ${isRoomHost ? 'host' : 'guest'}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('room-error', { error: 'Failed to join room' });
      }
    });

    socket.on('set-video', ({ roomId, videoUrl }) => {
      try {
        const room = rooms.get(roomId);
        const user = users.get(socket.id);

        if (!room || !user || room.hostId !== socket.id) {
          socket.emit('error', { error: 'Only the host can set the video' });
          return;
        }

        // Determine video type
        let videoType = 'mp4';
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
          videoType = 'youtube';
        }

        room.videoUrl = videoUrl;
        room.videoType = videoType;
        room.videoState = {
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          lastUpdateTime: Date.now(),
        };

        io.to(roomId).emit('video-set', { videoUrl, videoType });
        console.log(`Video set in room ${roomId}: ${videoUrl}`);
      } catch (error) {
        console.error('Error setting video:', error);
        socket.emit('error', { error: 'Failed to set video' });
      }
    });

    socket.on('leave-room', ({ roomId }) => {
      try {
        const user = users.get(socket.id);
        if (user && user.roomId === roomId) {
          const room = rooms.get(roomId);
          if (room) {
            // If the host is leaving, close the entire room and kick everyone out
            if (room.hostId === socket.id) {
              console.log(
                `🚪 Host manually left room ${roomId}, closing room and kicking all users`
              );

              // Notify all remaining users that the room is being closed
              socket.to(roomId).emit('room-error', {
                error: 'The host has left the room. Redirecting to home page...',
              });

              // Remove all users from the room
              room.users.forEach(roomUser => {
                users.delete(roomUser.id);
              });

              // Delete the room
              rooms.delete(roomId);

              console.log(`Room ${roomId} has been closed`);
            } else {
              // Regular user leaving - just remove them from the room
              room.users = room.users.filter(u => u.id !== socket.id);

              // If no users left, delete the room
              if (room.users.length === 0) {
                rooms.delete(roomId);
              } else {
                // Notify remaining users that this user left
                socket.to(roomId).emit('user-left', { userId: socket.id });
              }
            }
          }

          users.delete(socket.id);
          socket.leave(roomId);
        }
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    socket.on('play-video', ({ roomId, currentTime }) => {
      try {
        const room = rooms.get(roomId);
        const user = users.get(socket.id);

        if (!room || !user || room.hostId !== socket.id) {
          socket.emit('error', { error: 'Only the host can control the video' });
          return;
        }

        room.videoState = {
          isPlaying: true,
          currentTime,
          duration: room.videoState.duration,
          lastUpdateTime: Date.now(),
        };

        socket.to(roomId).emit('video-played', {
          currentTime,
          timestamp: room.videoState.lastUpdateTime,
        });

        console.log(`Video played in room ${roomId} at ${currentTime}s`);
      } catch (error) {
        console.error('Error playing video:', error);
        socket.emit('error', { error: 'Failed to play video' });
      }
    });

    socket.on('pause-video', ({ roomId, currentTime }) => {
      try {
        const room = rooms.get(roomId);
        const user = users.get(socket.id);

        if (!room || !user || room.hostId !== socket.id) {
          socket.emit('error', { error: 'Only the host can control the video' });
          return;
        }

        room.videoState = {
          isPlaying: false,
          currentTime,
          duration: room.videoState.duration,
          lastUpdateTime: Date.now(),
        };

        socket.to(roomId).emit('video-paused', {
          currentTime,
          timestamp: room.videoState.lastUpdateTime,
        });

        console.log(`Video paused in room ${roomId} at ${currentTime}s`);
      } catch (error) {
        console.error('Error pausing video:', error);
        socket.emit('error', { error: 'Failed to pause video' });
      }
    });

    socket.on('seek-video', ({ roomId, currentTime }) => {
      try {
        const room = rooms.get(roomId);
        const user = users.get(socket.id);

        if (!room || !user || room.hostId !== socket.id) {
          socket.emit('error', { error: 'Only the host can control the video' });
          return;
        }

        room.videoState = {
          ...room.videoState,
          currentTime,
          lastUpdateTime: Date.now(),
        };

        socket.to(roomId).emit('video-seeked', {
          currentTime,
          timestamp: room.videoState.lastUpdateTime,
        });

        console.log(`Video seeked in room ${roomId} to ${currentTime}s`);
      } catch (error) {
        console.error('Error seeking video:', error);
        socket.emit('error', { error: 'Failed to seek video' });
      }
    });

    socket.on('send-message', ({ roomId, message }) => {
      try {
        const user = users.get(socket.id);
        if (!user) {
          socket.emit('error', { error: 'Not authenticated' });
          return;
        }

        const chatMessage = {
          id: Date.now().toString(),
          userId: socket.id,
          userName: user.name,
          message: message.trim(),
          timestamp: new Date(),
          roomId,
        };

        io.to(roomId).emit('new-message', { message: chatMessage });

        console.log(`Message sent in room ${roomId} by ${user.name}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      const user = users.get(socket.id);
      if (user && user.roomId) {
        const room = rooms.get(user.roomId);
        if (room) {
          // If the host is leaving, close the entire room and kick everyone out
          if (room.hostId === socket.id) {
            console.log(`🚪 Host left room ${user.roomId}, closing room and kicking all users`);

            // Notify all remaining users that the room is being closed
            socket.to(user.roomId).emit('room-error', {
              error: 'The host has left the room. Redirecting to home page...',
            });

            // Remove all users from the room
            room.users.forEach(roomUser => {
              users.delete(roomUser.id);
            });

            // Delete the room
            rooms.delete(user.roomId);

            console.log(`Room ${user.roomId} has been closed`);
          } else {
            // Regular user leaving - just remove them from the room
            room.users = room.users.filter(u => u.id !== socket.id);

            // If no users left, delete the room
            if (room.users.length === 0) {
              rooms.delete(user.roomId);
            } else {
              // Notify remaining users that this user left
              socket.to(user.roomId).emit('user-left', { userId: socket.id });
            }
          }
        }

        users.delete(socket.id);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
