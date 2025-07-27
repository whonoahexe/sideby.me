import { Socket, Server as IOServer } from 'socket.io';
import { redisService } from '@/server/redis';
import { SetVideoDataSchema, VideoControlDataSchema, SyncCheckDataSchema } from '@/types';
import { SocketEvents, SocketData } from '../types';
import { validateData } from '../utils';

export function registerVideoHandlers(socket: Socket<SocketEvents, SocketEvents, object, SocketData>, io: IOServer) {
  // Set video URL
  socket.on('set-video', async data => {
    try {
      const validatedData = validateData(SetVideoDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId, videoUrl } = validatedData;
      const room = await redisService.rooms.getRoom(roomId);
      if (!room) {
        socket.emit('room-error', { error: 'Room not found' });
        return;
      }

      const currentUser = room.users.find(u => u.id === socket.data.userId);
      if (!currentUser?.isHost) {
        socket.emit('error', { error: 'Only hosts can set the video' });
        return;
      }

      // Determine video type
      let videoType: 'youtube' | 'mp4' | 'm3u8' = 'mp4';
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        videoType = 'youtube';
      } else if (videoUrl.match(/\.(m3u8)(\?.*)?$/i) || videoUrl.includes('/live/') || videoUrl.includes('.m3u8')) {
        videoType = 'm3u8';
      }

      await redisService.rooms.setVideoUrl(roomId, videoUrl, videoType);

      io.to(roomId).emit('video-set', { videoUrl, videoType });
      console.log(`Video set in room ${roomId}: ${videoUrl}`);
    } catch (error) {
      console.error('Error setting video:', error);
      socket.emit('error', { error: 'Failed to set video' });
    }
  });

  // Play video
  socket.on('play-video', async data => {
    try {
      const validatedData = validateData(VideoControlDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId, currentTime } = validatedData;
      const room = await redisService.rooms.getRoom(roomId);
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

      await redisService.rooms.updateVideoState(roomId, videoState);

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
  socket.on('pause-video', async data => {
    try {
      const validatedData = validateData(VideoControlDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId, currentTime } = validatedData;
      const room = await redisService.rooms.getRoom(roomId);
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

      await redisService.rooms.updateVideoState(roomId, videoState);

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
  socket.on('seek-video', async data => {
    try {
      const validatedData = validateData(VideoControlDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId, currentTime } = validatedData;
      const room = await redisService.rooms.getRoom(roomId);
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

      await redisService.rooms.updateVideoState(roomId, videoState);

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

  // Sync check for hosts
  socket.on('sync-check', async data => {
    try {
      const validatedData = validateData(SyncCheckDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId, currentTime, isPlaying, timestamp } = validatedData;

      if (!socket.data.userId) {
        socket.emit('error', { error: 'Not authenticated' });
        return;
      }

      const room = await redisService.rooms.getRoom(roomId);
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

      console.log(`Sync check sent in room ${roomId}: ${currentTime.toFixed(2)}s, playing: ${isPlaying}`);
    } catch (error) {
      console.error('Error sending sync check:', error);
      socket.emit('error', { error: 'Failed to send sync check' });
    }
  });
}
