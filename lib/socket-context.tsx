'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '@/types';

interface SocketContextType {
  socket: Socket<SocketEvents, SocketEvents> | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

// Singleton socket instance
let socketInstance: Socket<SocketEvents, SocketEvents> | null = null;
let isCreatingSocket = false;

const getSocket = (): Socket<SocketEvents, SocketEvents> => {
  if (!socketInstance && !isCreatingSocket) {
    isCreatingSocket = true;
    console.log('Creating new socket instance');
    socketInstance = io(
      process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000',
      {
        path: '/api/socket/io',
        addTrailingSlash: false,
        transports: ['websocket', 'polling'],
        forceNew: false,
        reconnection: true,
        timeout: 20000,
        autoConnect: true,
      }
    );
    isCreatingSocket = false;
  } else if (socketInstance) {
    console.log('Reusing existing socket instance');
  }
  return socketInstance!;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket<SocketEvents, SocketEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (isInitialized) return;
    setIsInitialized(true);

    const socketInstance = getSocket();
    setSocket(socketInstance);

    const onConnect = () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason: string) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    // Set initial connection state
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    // Cleanup on page unload
    const handleBeforeUnload = () => {
      disconnectSocket();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('connect_error', onConnectError);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Don't disconnect the socket here - keep it alive for navigation
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
  );
};

// Cleanup function for when the app unmounts
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
