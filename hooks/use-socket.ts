'use client';

import { useSocket as useSocketContext } from '@/contexts/socket';

export function useSocket() {
  return useSocketContext();
}
