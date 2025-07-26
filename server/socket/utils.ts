import { Socket } from 'socket.io';
import { z } from 'zod';
import { SocketEvents, SocketData } from './types';

// Helper function for validating data with Zod schemas
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  socket: Socket<SocketEvents, SocketEvents, object, SocketData>
): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.issues);
      socket.emit('room-error', {
        error: `Invalid data: ${error.issues.map(issue => issue.message).join(', ')}`,
      });
    } else {
      console.error('❌ Unexpected validation error:', error);
      socket.emit('room-error', { error: 'Invalid data provided' });
    }
    return null;
  }
}
