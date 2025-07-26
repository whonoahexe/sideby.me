import { SocketEvents as ImportedSocketEvents } from '@/types';

export interface SocketData {
  userId: string;
  userName: string;
  roomId?: string;
}

export type SocketEvents = ImportedSocketEvents;
