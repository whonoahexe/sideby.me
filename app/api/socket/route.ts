import { Server as HTTPServer } from 'http';
import { initSocketIO } from '@/lib/socket-server';

export async function GET() {
  // This endpoint initializes Socket.IO on the server

  return new Response('Socket.IO server endpoint', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

// This will be used in development mode
if (process.env.NODE_ENV === 'development') {
  // Initialize Socket.IO when this module is loaded
  const httpServer = new HTTPServer();
  initSocketIO(httpServer);
}
