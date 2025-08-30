import { Socket, Server as IOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { redisService } from '@/server/redis';
import { ChatMessage, SendMessageDataSchema, RoomActionDataSchema } from '@/types';
import { SocketEvents, SocketData } from '../types';
import { validateData } from '../utils';

export function registerChatHandlers(socket: Socket<SocketEvents, SocketEvents, object, SocketData>, io: IOServer) {
  // Typing indicators
  socket.on('typing-start', async data => {
    try {
      const validatedData = validateData(RoomActionDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId } = validatedData;

      if (!socket.data.userId || !socket.data.userName) {
        socket.emit('error', { error: 'Hmm, we lost your connection details.' });
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
      socket.emit('error', { error: `Just a heads-up: your 'typing...' indicator might not be working right now.` });
    }
  });

  socket.on('typing-stop', async data => {
    try {
      const validatedData = validateData(RoomActionDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId } = validatedData;

      if (!socket.data.userId) {
        socket.emit('error', { error: 'Hmm, we lost your connection details.' });
        return;
      }

      // Broadcast to all other users in the room that this user stopped typing
      socket.to(roomId).emit('user-stopped-typing', {
        userId: socket.data.userId,
      });

      console.log(`${socket.data.userName} stopped typing in room ${roomId}`);
    } catch (error) {
      console.error('Error handling typing stop:', error);
      socket.emit('error', {
        error: `We're having a little trouble with the typing notifications. Your messages should still send fine!`,
      });
    }
  });

  // Send chat message
  socket.on('send-message', async data => {
    try {
      const validatedData = validateData(SendMessageDataSchema, data, socket);
      if (!validatedData) return;

      const { roomId, message } = validatedData;

      if (!socket.data.userId || !socket.data.userName) {
        socket.emit('error', { error: 'Hmm, we lost your connection details.' });
        return;
      }

      const chatMessage: ChatMessage = {
        id: uuidv4(),
        userId: socket.data.userId,
        userName: socket.data.userName,
        message: message.trim(),
        timestamp: new Date(),
        roomId,
        isRead: false,
      };

      await redisService.chat.addChatMessage(roomId, chatMessage);

      io.to(roomId).emit('new-message', { message: chatMessage });

      console.log(`Message sent in room ${roomId} by ${socket.data.userName}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', {
        error: 'Your message got lost in the void! Sorry about that. Please try sending it one more time.',
      });
    }
  });
}
