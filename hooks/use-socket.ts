'use client';

import { useSocket as useSocketContext } from '@/contexts/socket-provider';

export function useSocket() {
  return useSocketContext();
}
