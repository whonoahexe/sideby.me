'use client';

import { useSocket as useSocketContext } from '@/lib/socket-context';

export function useSocket() {
  return useSocketContext();
}
