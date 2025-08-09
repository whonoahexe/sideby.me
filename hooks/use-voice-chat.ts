'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { User } from '@/types';

type PeerConnectionEntry = {
  peerConnection: RTCPeerConnection;
  remoteAudioEl: HTMLAudioElement;
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

const STUN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  },
];

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

  const rtcConfig = useMemo<RTCConfiguration>(
    () => ({
      iceServers: STUN_SERVERS,
      sdpSemantics: 'unified-plan',
    }),
    []
  );

  const cleanupPeer = useCallback((userId: string) => {
    dlog('cleanupPeer', { userId });
    const entry = peersRef.current.get(userId);
    if (!entry) return;
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
    async (peerUserId: string, isInitiator: boolean) => {
      if (!socket) return;
      if (peersRef.current.has(peerUserId)) return peersRef.current.get(peerUserId)!.peerConnection;

      dlog('createPeerConnection', { peerUserId, isInitiator });
      const pc = new RTCPeerConnection(rtcConfig);

      pc.onicecandidate = event => {
        if (event.candidate) {
          dlog('local ICE', { peerUserId, hasCandidate: true, type: event.candidate.type });
          socket.emit('voice-ice-candidate', { roomId, targetUserId: peerUserId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        dlog('connectionState', { peerUserId, state: pc.connectionState });
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          cleanupPeer(peerUserId);
        }
      };

      const remoteAudioEl = document.createElement('audio');
      remoteAudioEl.autoplay = true;
      remoteAudioEl.dataset.userId = peerUserId;
      document.body.appendChild(remoteAudioEl);

      pc.ontrack = event => {
        dlog('ontrack', { peerUserId, streams: event.streams.length });
        remoteAudioEl.srcObject = event.streams[0];
        // Attempt to play immediately; some browsers need a direct call
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

      peersRef.current.set(peerUserId, { peerConnection: pc, remoteAudioEl });
      setActivePeerIds(prev => (prev.includes(peerUserId) ? prev : [...prev, peerUserId]));

      if (isInitiator) {
        dlog('createOffer', { peerUserId });
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        dlog('send voice-offer', { peerUserId });
        socket.emit('voice-offer', { roomId, targetUserId: peerUserId, sdp: offer });
      }

      return pc;
    },
    [socket, roomId, rtcConfig, ensureLocalStream, cleanupPeer]
  );

  // Socket signaling handlers
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleExistingPeers = ({ userIds }: { userIds: string[] }) => {
      dlog('handleExistingPeers', { userIds });
      const availableSlots = Math.max(0, maxParticipants - 1); // excluding self
      const limited = userIds.slice(0, availableSlots);
      // Sort to ensure deterministic offer order, reducing glare
      limited
        .filter(peerId => peerId !== currentUser.id)
        .sort()
        .forEach(async peerId => {
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
  }, [socket, currentUser, createPeerConnection, cleanupPeer, roomId, maxParticipants]);

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
    socket.emit('voice-leave', { roomId });
    await cleanupAll();
    dlog('disable done');
  }, [socket, roomId, cleanupAll]);

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
      cleanupAll();
    };
  }, [cleanupAll]);

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
