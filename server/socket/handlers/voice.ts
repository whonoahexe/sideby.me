import { Socket, Server as IOServer } from 'socket.io';
import { SocketData, SocketEvents } from '../types';
import { validateData } from '../utils';
import {
  VoiceJoinDataSchema,
  VoiceLeaveDataSchema,
  VoiceOfferSchema,
  VoiceAnswerSchema,
  VoiceIceCandidateSchema,
  RoomActionDataSchema,
} from '@/types';
import { redisService } from '@/server/redis';

// Soft cap for voice participants in mesh
const VOICE_MAX_PARTICIPANTS = 5;

export function registerVoiceHandlers(socket: Socket<SocketEvents, SocketEvents, object, SocketData>, io: IOServer) {
  const slog = (event: string, extra?: Record<string, unknown>) => {
    console.log('[VOICE]', event, {
      socketId: socket.id,
      userId: socket.data.userId,
      roomId: socket.data.roomId,
      ...extra,
    });
  };
  // Join voice
  socket.on('voice-join', async data => {
    slog('voice-join received');
    const validated = validateData(VoiceJoinDataSchema, data, socket);
    if (!validated) return;

    const { roomId } = validated;
    if (!socket.data.userId) {
      socket.emit('voice-error', { error: 'Not authenticated' });
      return;
    }

    const room = await redisService.rooms.getRoom(roomId);
    if (!room) {
      socket.emit('voice-error', { error: 'Room not found' });
      return;
    }

    const currentVoiceUserIds = Array.from(io.sockets.adapter.rooms.get(`voice:${roomId}`) || new Set<string>());

    // Enforce soft cap
    if (currentVoiceUserIds.length >= VOICE_MAX_PARTICIPANTS) {
      slog('voice-join rejected: full');
      socket.emit('voice-error', { error: 'Voice chat is full (max 5 participants).' });
      return;
    }

    // Join a dedicated voice namespace room
    await socket.join(`voice:${roomId}`);
    slog('joined voice room', { voiceRoom: `voice:${roomId}` });

    // Provide existing peers to new joiner
    const peers = Array.from(io.sockets.adapter.rooms.get(`voice:${roomId}`) || new Set<string>()).filter(
      id => id !== socket.id
    );

    // Map socket ids in voice room to userIds but only if the socket is still in the main room
    const peerUserIds = peers
      .map(id => io.sockets.sockets.get(id) as Socket<SocketEvents, SocketEvents, object, SocketData> | undefined)
      .filter((s): s is Socket<SocketEvents, SocketEvents, object, SocketData> => Boolean(s))
      .filter(s => s.data.roomId === roomId)
      .map(s => s.data.userId)
      .filter((id): id is string => Boolean(id));

    slog('sending existing peers', { count: peerUserIds.length });
    socket.emit('voice-existing-peers', { userIds: peerUserIds });

    // Notify others about this peer
    socket.to(`voice:${roomId}`).emit('voice-peer-joined', { userId: socket.data.userId });
    slog('broadcasted peer-joined');
  });

  // Leave voice
  socket.on('voice-leave', async data => {
    slog('voice-leave received');
    const validated = validateData(VoiceLeaveDataSchema, data, socket);
    if (!validated) return;
    const { roomId } = validated;
    if (!socket.data.userId) return;
    await socket.leave(`voice:${roomId}`);
    socket.to(`voice:${roomId}`).emit('voice-peer-left', { userId: socket.data.userId });
    slog('left voice room and broadcasted peer-left');
  });

  // Relay offer (include sender id)
  socket.on('voice-offer', async data => {
    slog('voice-offer relay');
    const validated = validateData(VoiceOfferSchema, data, socket);
    if (!validated) return;
    const { roomId, targetUserId, sdp } = validated;
    // Find socket for target user in room
    const targetSocket = findSocketByUserId(io, targetUserId);
    if (!targetSocket) {
      slog('voice-offer target not found', { targetUserId });
      socket.emit('voice-error', { error: 'Target user not found' });
      return;
    }
    targetSocket.emit('voice-offer-received', { fromUserId: socket.data.userId!, sdp });
  });

  // Relay answer (include sender id)
  socket.on('voice-answer', async data => {
    slog('voice-answer relay');
    const validated = validateData(VoiceAnswerSchema, data, socket);
    if (!validated) return;
    const { roomId, targetUserId, sdp } = validated;
    const targetSocket = findSocketByUserId(io, targetUserId);
    if (!targetSocket) {
      slog('voice-answer target not found', { targetUserId });
      socket.emit('voice-error', { error: 'Target user not found' });
      return;
    }
    targetSocket.emit('voice-answer-received', { fromUserId: socket.data.userId!, sdp });
  });

  // Relay ICE candidates (include sender id)
  socket.on('voice-ice-candidate', async data => {
    slog('voice-ice relay');
    const validated = validateData(VoiceIceCandidateSchema, data, socket);
    if (!validated) return;
    const { roomId, targetUserId, candidate } = validated;
    const targetSocket = findSocketByUserId(io, targetUserId);
    if (!targetSocket) {
      slog('voice-ice target not found', { targetUserId });
      socket.emit('voice-error', { error: 'Target user not found' });
      return;
    }
    targetSocket.emit('voice-ice-candidate-received', { fromUserId: socket.data.userId!, candidate });
  });

  // Ensure peers are notified on disconnect
  socket.on('disconnecting', () => {
    slog('disconnecting');
    try {
      const rooms = socket.rooms;
      for (const room of rooms) {
        if (room.startsWith('voice:') && socket.data.userId) {
          socket.to(room).emit('voice-peer-left', { userId: socket.data.userId });
          slog('broadcasted peer-left on disconnect', { room });
          // Also proactively leave the voice room to update adapter state
          const maybePromise = socket.leave(room);
          if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
            (maybePromise as Promise<void>).catch(() => {});
          }
        }
      }
    } catch {
      // ignore
    }
  });
}

function findSocketByUserId(
  io: IOServer,
  userId: string
): Socket<SocketEvents, SocketEvents, object, SocketData> | undefined {
  for (const [, s] of io.sockets.sockets) {
    const socket = s as Socket<SocketEvents, SocketEvents, object, SocketData>;
    if (socket.data.userId === userId) {
      return socket;
    }
  }
  return undefined;
}
