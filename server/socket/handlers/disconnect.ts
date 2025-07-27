import { Socket } from 'socket.io';
import { SocketEvents, SocketData } from '../types';
import { handleLeaveRoom } from './room';

export async function handleDisconnect(socket: Socket<SocketEvents, SocketEvents, object, SocketData>) {
  console.log('User disconnected:', socket.id);

  if (socket.data.roomId && socket.data.userId) {
    await handleLeaveRoom(socket, socket.data.roomId, false); // false indicates disconnect
  }
}
