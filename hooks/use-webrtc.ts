'use client';

import { useCallback, useRef } from 'react';
import { createStunOnlyRTCConfiguration, createRTCConfiguration } from '@/lib/ice-server';

export interface PeerMapEntry {
  pc: RTCPeerConnection;
  isUsingTurn: boolean;
  connectionAttempt: number;
}

export interface UseWebRTCOptions {
  kind: 'audio' | 'video' | 'data';
}

export interface UseWebRTCReturn {
  getOrCreatePeer: (id: string, initiator: boolean, forceTurn?: boolean) => Promise<RTCPeerConnection>;
  removePeer: (id: string) => void;
  peers: () => string[];
  closeAll: () => void;
}

// Focused hook on peer connection lifecycle
export function useWebRTC(_opts: UseWebRTCOptions): UseWebRTCReturn {
  const peersRef = useRef<Map<string, PeerMapEntry>>(new Map());

  const removePeer = useCallback((id: string) => {
    const entry = peersRef.current.get(id);
    if (!entry) return;
    try {
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.close();
    } catch {}
    peersRef.current.delete(id);
  }, []);

  const closeAll = useCallback(() => {
    for (const id of Array.from(peersRef.current.keys())) removePeer(id);
  }, [removePeer]);

  const getOrCreatePeer = useCallback(
    async (id: string, initiator: boolean, forceTurn: boolean = false) => {
      const existing = peersRef.current.get(id);
      if (existing && !forceTurn) return existing.pc;

      if (existing && forceTurn) {
        removePeer(id); // rebuild
      }

      const cfg = forceTurn ? await createRTCConfiguration() : createStunOnlyRTCConfiguration();
      const pc = new RTCPeerConnection(cfg);
      peersRef.current.set(id, { pc, isUsingTurn: forceTurn, connectionAttempt: forceTurn ? 2 : 1 });

      return pc;
    },
    [removePeer]
  );

  return {
    getOrCreatePeer,
    removePeer,
    peers: () => Array.from(peersRef.current.keys()),
    closeAll,
  };
}
