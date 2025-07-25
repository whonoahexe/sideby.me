// In-memory storage for development (replace with Redis in production!!??)
const rooms = new Map();
const users = new Map();

function setupSocketHandlers(io) {
  io.on('connection', socket => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ hostName }) => {
      try {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
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
        socket.emit('room-created', { roomId, room });

        console.log(`Room ${roomId} created by ${hostName}`);
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('room-error', { error: 'Failed to create room' });
      }
    });

    socket.on('join-room', ({ roomId, userName }) => {
      try {
        const room = rooms.get(roomId);
        if (!room) {
          socket.emit('room-error', { error: 'Room not found' });
          return;
        }

        // Check if this user is already in the room (by name)
        const existingUser = room.users.find(u => u.name === userName);
        if (existingUser) {
          // User already exists in room, just update their socket data and emit join success
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

        // Check if this user is the room host (by name)
        const isRoomHost = room.hostName === userName;

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
          // Remove user from room
          room.users = room.users.filter(u => u.id !== socket.id);

          // If no users left, delete the room
          if (room.users.length === 0) {
            rooms.delete(user.roomId);
          } else if (room.hostId === socket.id && room.users.length > 0) {
            // If host left, assign new host
            const newHost = room.users[0];
            room.hostId = newHost.id;
            room.hostName = newHost.name;
            newHost.isHost = true;
          }

          socket.to(user.roomId).emit('user-left', { userId: socket.id });
        }

        users.delete(socket.id);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
