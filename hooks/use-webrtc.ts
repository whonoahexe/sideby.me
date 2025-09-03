'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  createStunOnlyRTCConfiguration,
  createRTCConfiguration,
  createTurnOnlyRTCConfiguration,
} from '@/lib/ice-server';

export interface PeerMapEntry {
  pc: RTCPeerConnection;
  isUsingTurn: boolean;
  connectionAttempt: number;
}

export interface UseWebRTCOptions {
  // Fired when a local ICE candidate is gathered
  onIceCandidate?: (peerId: string, candidate: RTCIceCandidate) => void;
  // Fired on any connection state change
  onConnectionStateChange?: (
    peerId: string,
    state: RTCPeerConnectionState,
    pc: RTCPeerConnection,
    meta: { usingTurn: boolean; attempt: number }
  ) => void;
  // Fired when a remote track is received
  onTrack?: (
    peerId: string,
    ev: RTCTrackEvent,
    pc: RTCPeerConnection,
    meta: { usingTurn: boolean; attempt: number }
  ) => void;
}

export interface UseWebRTCReturn {
  getOrCreatePeer: (id: string, initiator: boolean, forceTurn?: boolean) => Promise<RTCPeerConnection>;
  removePeer: (id: string) => void;
  peers: () => string[];
  closeAll: () => void;
  forceTurnReconnect: (id: string, initiator: boolean) => Promise<RTCPeerConnection | null>;
}

// Focused hook on peer connection lifecycle
export function useWebRTC(options: UseWebRTCOptions = {}): UseWebRTCReturn {
  const peersRef = useRef<Map<string, PeerMapEntry>>(new Map());
  const iceHandlerRef = useRef<UseWebRTCOptions['onIceCandidate']>(undefined);
  const stateHandlerRef = useRef<UseWebRTCOptions['onConnectionStateChange']>(undefined);
  const trackHandlerRef = useRef<UseWebRTCOptions['onTrack']>(undefined);

  // Keep latest callbacks without re-binding existing peer listeners
  useEffect(() => {
    iceHandlerRef.current = options.onIceCandidate;
  }, [options.onIceCandidate]);
  useEffect(() => {
    stateHandlerRef.current = options.onConnectionStateChange;
  }, [options.onConnectionStateChange]);
  useEffect(() => {
    trackHandlerRef.current = options.onTrack;
  }, [options.onTrack]);

  const removePeer = useCallback((id: string) => {
    const entry = peersRef.current.get(id);
    if (!entry) return;
    try {
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.onconnectionstatechange = null;
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
        removePeer(id);
      }

      // 3 attempts strategy
      let cfg: RTCConfiguration;
      if (forceTurn) {
        // Distinguish between a second attempt with all vs a third with relay-only by checking existing entry
        if (existing && (existing as PeerMapEntry).connectionAttempt >= 2) {
          cfg = await createTurnOnlyRTCConfiguration();
        } else {
          cfg = await createRTCConfiguration();
        }
      } else {
        cfg = createStunOnlyRTCConfiguration();
      }
      const pc = new RTCPeerConnection(cfg);
      const attempt = forceTurn ? (existing ? existing.connectionAttempt + 1 : 2) : 1;
      const entry: PeerMapEntry = { pc, isUsingTurn: forceTurn, connectionAttempt: attempt };
      peersRef.current.set(id, entry);

      // Attach generic event listeners once per peer
      pc.onicecandidate = ev => {
        if (ev.candidate && iceHandlerRef.current) {
          try {
            iceHandlerRef.current(id, ev.candidate);
          } catch {}
        }
      };
      pc.onconnectionstatechange = () => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[WEBRTC] connectionState', {
            peerId: id,
            state: pc.connectionState,
            attempt: entry.connectionAttempt,
            usingTurn: entry.isUsingTurn,
          });
        }
        if (stateHandlerRef.current) {
          try {
            stateHandlerRef.current(id, pc.connectionState, pc, {
              usingTurn: entry.isUsingTurn,
              attempt: entry.connectionAttempt,
            });
          } catch {}
        }
        // Fallback if we fail on attempt 1 (stun-only) schedule a forced reconnect with all/turn
        if (pc.connectionState === 'failed' && entry.connectionAttempt === 1) {
          // Recreate with full config (STUN+TURN) after short delay to allow signaling cleanup upstream
          setTimeout(() => {
            forceTurnReconnect(id, true).catch(() => {});
          }, 250);
        } else if (pc.connectionState === 'failed' && entry.connectionAttempt === 2) {
          // Second failure -> escalate to TURN-only
          setTimeout(() => {
            forceTurnReconnect(id, true).catch(() => {});
          }, 300);
        }
      };
      pc.ontrack = ev => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[WEBRTC] ontrack', { peerId: id, streams: ev.streams.length });
        }
        if (trackHandlerRef.current) {
          try {
            trackHandlerRef.current(id, ev, pc, {
              usingTurn: entry.isUsingTurn,
              attempt: entry.connectionAttempt,
            });
          } catch {}
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[WEBRTC] iceConnectionState', { peerId: id, state: pc.iceConnectionState });
        }
      };

      return pc;
    },
    [removePeer]
  );

  const forceTurnReconnect = useCallback(
    async (id: string, initiator: boolean) => {
      const existing = peersRef.current.get(id);
      if (existing) removePeer(id);
      return getOrCreatePeer(id, initiator, true);
    },
    [getOrCreatePeer, removePeer]
  );

  return {
    getOrCreatePeer,
    removePeer,
    peers: () => Array.from(peersRef.current.keys()),
    closeAll,
    forceTurnReconnect,
  };
}
