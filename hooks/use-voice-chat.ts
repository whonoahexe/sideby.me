'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { User } from '@/types';
import { createStunOnlyRTCConfiguration, createRTCConfiguration } from '@/lib/ice-server';
import { toast } from 'sonner';

type PeerConnectionEntry = {
  peerConnection: RTCPeerConnection;
  remoteAudioEl: HTMLAudioElement;
  connectionAttempt: number;
  isUsingTurn: boolean;
  reconnectAttempts: number;
  reconnectTimeoutId: NodeJS.Timeout | null;
};

interface UseVoiceChatOptions {
  roomId: string;
  currentUser: User | null;
  maxParticipants?: number;
}

interface UseVoiceChatReturn {
  isEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  error: string;
  activePeerIds: string[]; // userIds
  speakingUserIds: Set<string>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  toggleMute: () => void;
}

// Connection timeout constants
const STUN_CONNECTION_TIMEOUT = 4000;
// Bandwidth patrol: auto-disconnect solo users after 2 minutes
const SOLO_USER_TIMEOUT = 120000;
// Reconnection constants
const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useVoiceChat({ roomId, currentUser, maxParticipants = 5 }: UseVoiceChatOptions): UseVoiceChatReturn {
  const { socket } = useSocket();
  const isDebug = process.env.NODE_ENV !== 'production';
  const dlog = (...args: unknown[]) => {
    if (isDebug) console.log('[VOICE]', ...args);
  };
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [activePeerIds, setActivePeerIds] = useState<string[]>([]);
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerConnectionEntry>>(new Map());
  const appliedRemoteAnswerRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<
    Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; rafId: number | null }>
  >(new Map());
  const soloTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupPeer = useCallback((userId: string) => {
    dlog('cleanupPeer', { userId });
    const entry = peersRef.current.get(userId);
    if (!entry) return;

    // Clear reconnection timeout if it exists
    if (entry.reconnectTimeoutId) {
      clearTimeout(entry.reconnectTimeoutId);
    }

    entry.peerConnection.onicecandidate = null;
    entry.peerConnection.ontrack = null;
    entry.peerConnection.onconnectionstatechange = null;
    try {
      entry.peerConnection.close();
    } catch {}
    entry.remoteAudioEl.srcObject = null;
    entry.remoteAudioEl.remove();
    peersRef.current.delete(userId);
    appliedRemoteAnswerRef.current.delete(userId);
    setActivePeerIds(prev => prev.filter(id => id !== userId));
  }, []);

  const cleanupAll = useCallback(async () => {
    dlog('cleanupAll');
    for (const userId of Array.from(peersRef.current.keys())) {
      cleanupPeer(userId);
    }
    if (localStreamRef.current) {
      dlog('stopping local tracks');
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setIsEnabled(false);
    setIsConnecting(false);
    setIsMuted(false);
    setError('');
    setActivePeerIds([]);
  }, [cleanupPeer]);

  // Bandwidth Patrol: Auto-disconnect solo users to save bandwidth
  const startSoloUserTimeout = useCallback(() => {
    if (soloTimeoutRef.current) {
      clearTimeout(soloTimeoutRef.current);
    }

    dlog('🚨 Bandwidth Patrol: Starting solo user timeout (2 minutes)');

    soloTimeoutRef.current = setTimeout(async () => {
      dlog('🚨 Bandwidth Patrol: Solo timeout triggered - disconnecting user');

      // Show toast notification with ErrorDisplay-inspired styling
      toast.error('🚨 Bandwidth Patrol', {
        description:
          "Noah told me to end the call to save bandwidth because you're all alone. That stuff doesn't grow on trees!",
        duration: 4000,
        style: {
          border: '1px solid hsl(var(--destructive))',
          backgroundColor: 'hsl(var(--background))',
        },
        className: 'text-sm',
      });

      // Also set error state for any UI that might use it
      setError(
        "🚨 Noah told me to end the call to save bandwidth because you're all alone. That stuff doesn't grow on trees!"
      );

      // Auto-disconnect after a short delay to let user see the message
      setTimeout(async () => {
        if (socket) {
          socket.emit('voice-leave', { roomId });
          await cleanupAll();
        }
        setError(''); // Clear error after disconnect
      }, 3000);
    }, SOLO_USER_TIMEOUT);
  }, [socket, roomId, cleanupAll]);

  const clearSoloUserTimeout = useCallback(() => {
    if (soloTimeoutRef.current) {
      dlog('🚨 Bandwidth Patrol: Clearing solo timeout - friends joined!');

      clearTimeout(soloTimeoutRef.current);
      soloTimeoutRef.current = null;
    }
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      dlog('getUserMedia(audio)');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      dlog('getUserMedia success', { tracks: stream.getAudioTracks().length });
      localStreamRef.current = stream;
      // Initialize Web Audio for speaking detection (local)
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch {}
      }
      if (audioContextRef.current && currentUser?.id) {
        try {
          const ctx = audioContextRef.current;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const userId = currentUser.id;
          const tick = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            const isSpeakingNow = avg > 20;
            setSpeakingUserIds(prev => {
              const next = new Set(prev);
              if (isSpeakingNow) next.add(userId);
              else next.delete(userId);
              return next;
            });
            const id = requestAnimationFrame(tick);
            const entry = analyserNodesRef.current.get(userId);
            if (entry) entry.rafId = id;
          };
          analyserNodesRef.current.set(userId, { analyser, source, rafId: requestAnimationFrame(tick) });
        } catch {}
      }
      return stream;
    } catch (e) {
      dlog('getUserMedia error', e);
      setError('Microphone permission denied or unavailable');
      throw e;
    }
  }, []);

  const createPeerConnection = useCallback(
    async (peerUserId: string, isInitiator: boolean, useTurn: boolean = false) => {
      if (!socket) return;

      // If we already have a connection and it's not a TURN retry, return existing
      const existingEntry = peersRef.current.get(peerUserId);
      if (existingEntry && !useTurn) {
        return existingEntry.peerConnection;
      }

      dlog('createPeerConnection', { peerUserId, isInitiator, useTurn });

      // Clean up existing connection if this is a TURN retry
      if (existingEntry && useTurn) {
        dlog('Cleaning up existing connection for TURN retry', { peerUserId });
        cleanupPeer(peerUserId);
      }

      // Choose configuration based on whether this is a TURN fallback
      const rtcConfig = useTurn ? await createRTCConfiguration() : createStunOnlyRTCConfiguration();
      const pc = new RTCPeerConnection(rtcConfig);

      let connectionTimeout: NodeJS.Timeout | null = null;
      let hasConnected = false;
      const connectionAttempt = useTurn ? 2 : 1;

      // Setup connection timeout for STUN-only attempts
      if (!useTurn) {
        connectionTimeout = setTimeout(async () => {
          if (hasConnected || pc.connectionState === 'connected') return;

          dlog('STUN connection timeout, attempting TURN fallback', { peerUserId });

          // Clear the timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }

          // Attempt TURN fallback
          try {
            await createPeerConnection(peerUserId, isInitiator, true);
          } catch (error) {
            dlog('TURN fallback failed', { peerUserId, error });
            setError('Failed to establish voice connection');
          }
        }, STUN_CONNECTION_TIMEOUT);
      }

      pc.onicecandidate = event => {
        if (event.candidate) {
          dlog('local ICE', {
            peerUserId,
            hasCandidate: true,
            type: event.candidate.type,
            method: useTurn ? 'TURN' : 'STUN',
            attempt: connectionAttempt,
          });
          socket.emit('voice-ice-candidate', { roomId, targetUserId: peerUserId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        dlog('connectionState', {
          peerUserId,
          state: pc.connectionState,
          method: useTurn ? 'TURN' : 'STUN',
          attempt: connectionAttempt,
        });

        if (pc.connectionState === 'connected') {
          hasConnected = true;
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }

          // Reset reconnection attempts on successful connection
          const entry = peersRef.current.get(peerUserId);
          if (entry) {
            entry.reconnectAttempts = 0;
            if (entry.reconnectTimeoutId) {
              clearTimeout(entry.reconnectTimeoutId);
              entry.reconnectTimeoutId = null;
            }
          }

          dlog('🎉 Voice connection established', {
            peerUserId,
            method: useTurn ? 'TURN' : 'STUN',
            attempt: connectionAttempt,
          });
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }

          // For failed connections, attempt reconnection with exponential backoff
          if (pc.connectionState === 'failed' && !useTurn) {
            // For STUN failures, first try TURN fallback instead of reconnection
            dlog('STUN connection failed, attempting TURN fallback', { peerUserId });
            createPeerConnection(peerUserId, isInitiator, true).catch(error => {
              dlog('TURN fallback failed, starting reconnection logic', { peerUserId, error });
              // Start reconnection logic after TURN fails
              const entry = peersRef.current.get(peerUserId);
              if (entry && entry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                scheduleReconnection(peerUserId, isInitiator);
              } else {
                cleanupPeer(peerUserId);
              }
            });
            return; // Don't cleanup, TURN attempt will handle it
          }

          // If this was a TURN attempt, start reconnection logic
          if (useTurn && pc.connectionState === 'failed') {
            const entry = peersRef.current.get(peerUserId);
            if (entry && entry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              dlog('🔄 TURN connection failed, scheduling reconnection', {
                peerUserId,
                attempt: entry.reconnectAttempts + 1,
              });
              scheduleReconnection(peerUserId, isInitiator);
              return; // Don't cleanup immediately, let reconnection handle it
            }
          }

          // Only cleanup if this is a final failure or if connection was previously established
          if (useTurn || hasConnected || pc.connectionState === 'disconnected') {
            dlog('Connection failed permanently, cleaning up peer', {
              peerUserId,
              method: useTurn ? 'TURN' : 'STUN',
              finalFailure: true,
            });
            cleanupPeer(peerUserId);
          }
        }
      };

      const remoteAudioEl = document.createElement('audio');
      remoteAudioEl.autoplay = true;
      remoteAudioEl.dataset.userId = peerUserId;
      document.body.appendChild(remoteAudioEl);

      pc.ontrack = event => {
        dlog('ontrack', { peerUserId, streams: event.streams.length });
        remoteAudioEl.srcObject = event.streams[0];
        remoteAudioEl
          .play()
          .then(() => dlog('remote audio playing', { peerUserId }))
          .catch(err => dlog('remote audio play blocked', { peerUserId, err: String(err) }));

        // Start speaking detection for remote peer
        if (audioContextRef.current) {
          try {
            const ctx = audioContextRef.current;
            const source = ctx.createMediaStreamSource(event.streams[0]);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              const isSpeakingNow = avg > 20;
              setSpeakingUserIds(prev => {
                const next = new Set(prev);
                if (isSpeakingNow) next.add(peerUserId);
                else next.delete(peerUserId);
                return next;
              });
              const id = requestAnimationFrame(tick);
              const entry = analyserNodesRef.current.get(peerUserId);
              if (entry) entry.rafId = id;
            };
            const rafId = requestAnimationFrame(tick);
            analyserNodesRef.current.set(peerUserId, { analyser, source, rafId });
          } catch {}
        }
      };

      const localStream = await ensureLocalStream();
      localStream.getAudioTracks().forEach(track => pc.addTrack(track, localStream));

      peersRef.current.set(peerUserId, {
        peerConnection: pc,
        remoteAudioEl,
        connectionAttempt,
        isUsingTurn: useTurn,
        reconnectAttempts: 0,
        reconnectTimeoutId: null,
      });
      setActivePeerIds(prev => (prev.includes(peerUserId) ? prev : [...prev, peerUserId]));

      if (isInitiator) {
        dlog('createOffer', { peerUserId, useTurn });
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        dlog('send voice-offer', { peerUserId });
        socket.emit('voice-offer', { roomId, targetUserId: peerUserId, sdp: offer });
      }

      return pc;
    },
    [socket, roomId, ensureLocalStream, cleanupPeer]
  );

  // Exponential backoff reconnection logic
  const scheduleReconnection = useCallback(
    (peerUserId: string, wasInitiator: boolean) => {
      const entry = peersRef.current.get(peerUserId);
      if (!entry) return;

      if (entry.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        dlog('🔄 Max reconnection attempts reached for peer', { peerUserId, attempts: entry.reconnectAttempts });
        cleanupPeer(peerUserId);
        return;
      }

      const attempt = entry.reconnectAttempts + 1;
      const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt - 1), MAX_RECONNECT_DELAY);

      dlog('🔄 Scheduling reconnection', { peerUserId, attempt, delay });

      const timeoutId = setTimeout(async () => {
        try {
          dlog('🔄 Attempting reconnection', { peerUserId, attempt });

          // Clean up the old connection but keep the entry structure
          const oldEntry = peersRef.current.get(peerUserId);
          if (oldEntry) {
            oldEntry.peerConnection.close();
            oldEntry.remoteAudioEl.remove();
          }

          // Create new connection with incremented attempt count
          await createPeerConnection(peerUserId, wasInitiator, entry.isUsingTurn);

          // Update the attempt count for the new connection
          const newEntry = peersRef.current.get(peerUserId);
          if (newEntry) {
            newEntry.reconnectAttempts = attempt;
          }
        } catch (error) {
          dlog('🔄 Reconnection failed', { peerUserId, attempt, error });
          // If reconnection fails, schedule another attempt
          const currentEntry = peersRef.current.get(peerUserId);
          if (currentEntry && currentEntry.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            scheduleReconnection(peerUserId, wasInitiator);
          } else {
            cleanupPeer(peerUserId);
          }
        }
      }, delay);

      // Update the entry with the new timeout
      entry.reconnectTimeoutId = timeoutId;
      entry.reconnectAttempts = attempt;
    },
    [cleanupPeer, createPeerConnection]
  );

  // Socket signaling handlers
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleExistingPeers = ({ userIds }: { userIds: string[] }) => {
      dlog('handleExistingPeers', { userIds });
      const availableSlots = Math.max(0, maxParticipants - 1); // excluding self
      const limited = userIds.slice(0, availableSlots);

      // Bandwidth Patrol: Check if user is solo
      const otherPeers = limited.filter(peerId => peerId !== currentUser.id);
      if (otherPeers.length === 0) {
        dlog('🚨 Bandwidth Patrol: User is solo, starting timeout');
        startSoloUserTimeout();
      } else {
        dlog('🚨 Bandwidth Patrol: Other peers detected, clearing timeout');
        clearSoloUserTimeout();
      }

      // Sort to ensure deterministic offer order, reducing glare
      otherPeers.sort().forEach(async peerId => {
        if (!peersRef.current.has(peerId)) {
          dlog('initiate to peer from existing list', { peerId });
          await createPeerConnection(peerId, true);
        }
      });
    };

    const handlePeerJoined = async ({ userId }: { userId: string }) => {
      if (userId === currentUser.id) return;
      // To avoid offer glare, the newly joined peer will initiate offers via 'voice-existing-peers'.
      // Existing peers simply wait for offers from the joiner.
      dlog('handlePeerJoined (no-init, waiting for offer)', { userId });

      // Bandwidth Patrol: Someone joined, clear solo timeout
      dlog('🚨 Bandwidth Patrol: Peer joined, clearing solo timeout');
      clearSoloUserTimeout();
    };

    const handleOffer = async ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!currentUser) return;
      dlog('handleOffer', { fromUserId });
      const pc = await createPeerConnection(fromUserId, false);
      if (!pc) return;
      // Avoid re-applying offers when already stable (no renegotiation support in MVP)
      if (pc.signalingState !== 'stable') {
        dlog('skip offer apply; state not stable', { state: pc.signalingState });
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      dlog('setRemoteDescription(offer) done');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      dlog('setLocalDescription(answer) done');
      socket.emit('voice-answer', { roomId, targetUserId: fromUserId, sdp: answer });
      dlog('sent voice-answer', { to: fromUserId });
    };

    const handleAnswer = async ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      dlog('handleAnswer', { fromUserId });
      const entry = peersRef.current.get(fromUserId);
      if (!entry) return;
      const pc = entry.peerConnection;
      if (appliedRemoteAnswerRef.current.has(fromUserId)) return;
      if (pc.signalingState !== 'have-local-offer') {
        dlog('skip answer apply; unexpected state', { state: pc.signalingState });
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        appliedRemoteAnswerRef.current.add(fromUserId);
        dlog('setRemoteDescription(answer) done');
      } catch {
        // ignore duplicate or out-of-order answers
        dlog('setRemoteDescription(answer) failed (dup/out-of-order)');
      }
    };

    const handleIceCandidate = async ({
      fromUserId,
      candidate,
    }: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      dlog('handleIceCandidate', { fromUserId, hasCandidate: !!candidate });
      const entry = peersRef.current.get(fromUserId);
      if (!entry) return;
      try {
        await entry.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore
      }
    };

    const handlePeerLeft = ({ userId }: { userId: string }) => {
      dlog('handlePeerLeft', { userId });
      cleanupPeer(userId);
      // Defensive: if we somehow still count ourselves plus one, clamp the count by removing stale entries
      setActivePeerIds(prev => prev.filter(id => id !== userId));
      setSpeakingUserIds(prev => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

      // Bandwidth Patrol: Check if user is now solo after peer left
      const remainingPeers = Array.from(peersRef.current.keys()).filter(id => id !== userId);
      if (remainingPeers.length === 0) {
        dlog('🚨 Bandwidth Patrol: Last peer left, user is now solo');
        startSoloUserTimeout();
      }
    };

    const handleVoiceError = ({ error }: { error: string }) => {
      setError(error);
      dlog('handleVoiceError', { error });
    };

    socket.on('voice-existing-peers', handleExistingPeers);
    socket.on('voice-peer-joined', handlePeerJoined);
    socket.on('voice-offer-received', handleOffer);
    socket.on('voice-answer-received', handleAnswer);
    socket.on('voice-ice-candidate-received', handleIceCandidate);
    socket.on('voice-peer-left', handlePeerLeft);
    socket.on('voice-error', handleVoiceError);

    return () => {
      socket.off('voice-existing-peers', handleExistingPeers);
      socket.off('voice-peer-joined', handlePeerJoined);
      socket.off('voice-offer-received', handleOffer);
      socket.off('voice-answer-received', handleAnswer);
      socket.off('voice-ice-candidate-received', handleIceCandidate);
      socket.off('voice-peer-left', handlePeerLeft);
      socket.off('voice-error', handleVoiceError);
    };
  }, [
    socket,
    currentUser,
    createPeerConnection,
    cleanupPeer,
    roomId,
    maxParticipants,
    startSoloUserTimeout,
    clearSoloUserTimeout,
  ]);

  const enable = useCallback(async () => {
    if (!socket || !currentUser) return;
    dlog('enable start');
    setIsConnecting(true);
    try {
      await ensureLocalStream();
      socket.emit('voice-join', { roomId });
      setIsEnabled(true);
      setIsConnecting(false);
      dlog('enable done');
    } catch (e) {
      setIsConnecting(false);
      setIsEnabled(false);
      dlog('enable failed', e);
    }
  }, [socket, roomId, ensureLocalStream, currentUser]);

  const disable = useCallback(async () => {
    if (!socket) return;
    dlog('disable start');

    // Bandwidth Patrol: Clear solo timeout when disabling
    clearSoloUserTimeout();

    socket.emit('voice-leave', { roomId });
    await cleanupAll();
    dlog('disable done');
  }, [socket, roomId, cleanupAll, clearSoloUserTimeout]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setIsMuted(prev => !prev);
    dlog('toggleMute', { next: !isMuted });
  }, [isMuted]);

  // Autocleanup on unmount
  useEffect(() => {
    return () => {
      clearSoloUserTimeout();
      cleanupAll();
    };
  }, [cleanupAll, clearSoloUserTimeout]);

  return {
    isEnabled,
    isMuted,
    isConnecting,
    error,
    activePeerIds,
    speakingUserIds,
    enable,
    disable,
    toggleMute,
  };
}
