'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '@/types';

interface SocketContextType {
  socket: Socket<SocketEvents, SocketEvents> | null;
  isConnected: boolean;
  isInitialized: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isInitialized: false,
});

// Singleton socket instance
let socketInstance: Socket<SocketEvents, SocketEvents> | null = null;
let isCreatingSocket = false;

const getSocket = (): Socket<SocketEvents, SocketEvents> => {
  if (!socketInstance && !isCreatingSocket) {
    isCreatingSocket = true;
    console.log('Creating new socket instance');
    const socketUrl = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000';
    console.log('Socket URL:', socketUrl);

    socketInstance = io(socketUrl, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      timeout: 20000,
      autoConnect: true,
    });

    console.log('Socket instance created, id:', socketInstance.id);
    isCreatingSocket = false;
  } else if (socketInstance) {
    console.log('Reusing existing socket instance, id:', socketInstance.id);
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

    console.log('SocketProvider useEffect running...');

    const socketInstance = getSocket();
    setSocket(socketInstance);

    const onConnect = () => {
      console.log('✅ Socket connected successfully:', socketInstance.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason: string) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error('🚨 Socket connection error:', error);
      setIsConnected(false);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    // Set initial connection state and log it
    console.log('🔍 Initial socket connection state:', socketInstance.connected);
    console.log('🔍 Socket transport:', socketInstance.io.engine.transport?.name);

    if (socketInstance.connected) {
      console.log('✅ Socket already connected on mount');
      setIsConnected(true);
    } else {
      console.log('⏳ Socket not connected on mount, waiting for connection...');
      // Ensure connection is attempted
      if (socketInstance.disconnected) {
        console.log('🔄 Socket is disconnected, attempting to connect...');
        socketInstance.connect();
      }
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
  }, [isInitialized]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isInitialized }}>
      {children}
    </SocketContext.Provider>
  );
};

// Cleanup function for when the app unmounts
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
