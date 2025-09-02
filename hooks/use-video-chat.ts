'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { useMediaPermissions } from '@/hooks/use-media-permissions';
import { useWebRTC } from '@/hooks/use-webrtc';
import { User } from '@/types';
import { toast } from 'sonner';

interface UseVideoChatOptions {
  roomId: string;
  currentUser: User | null;
  maxParticipants?: number;
}

export interface RemoteVideoStream {
  userId: string;
  stream: MediaStream;
}

interface UseVideoChatReturn {
  isEnabled: boolean;
  isCameraOff: boolean;
  isConnecting: boolean;
  error: string;
  activePeerIds: string[];
  publicParticipantCount: number;
  remoteStreams: RemoteVideoStream[];
  localStream: MediaStream | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  toggleCamera: () => void; // enable/disable local video track
}

export function useVideoChat({ roomId, currentUser, maxParticipants = 5 }: UseVideoChatOptions): UseVideoChatReturn {
  const { socket } = useSocket();
  const { requestCamera } = useMediaPermissions();
  const cleanupPeerRef = useRef<(id: string) => void>(() => {});
  const { getOrCreatePeer, removePeer, closeAll } = useWebRTC({
    onIceCandidate: (peerId, candidate) => {
      if (!socket) return;
      socket.emit('videochat-ice-candidate', { roomId, targetUserId: peerId, candidate });
    },
    onConnectionStateChange: (peerId, state) => {
      if (state === 'failed' || state === 'disconnected' || state === 'closed') cleanupPeerRef.current(peerId);
    },
    onTrack: (peerId, ev) => {
      const stream = ev.streams[0];
      setRemoteStreams(prev => {
        const exists = prev.find(p => p.userId === peerId);
        if (exists) return prev.map(p => (p.userId === peerId ? { ...p, stream } : p));
        return [...prev, { userId: peerId, stream }];
      });
    },
  });

  const [isEnabled, setIsEnabled] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [activePeerIds, setActivePeerIds] = useState<string[]>([]);
  const [publicParticipantCount, setPublicParticipantCount] = useState(0);
  const [remoteStreams, setRemoteStreams] = useState<RemoteVideoStream[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const appliedRemoteAnswerRef = useRef<Set<string>>(new Set());
  const joinAttemptRef = useRef(false);

  const ensureLocalCamera = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await requestCamera(false); // video only; user can use voice separately
    if (!stream) throw new Error('camera-permission-denied');
    localStreamRef.current = stream;
    return stream;
  }, [requestCamera]);

  const cleanupPeer = useCallback(
    (peerId: string) => {
      removePeer(peerId);
      setActivePeerIds(prev => prev.filter(id => id !== peerId));
      setRemoteStreams(prev => prev.filter(v => v.userId !== peerId));
      appliedRemoteAnswerRef.current.delete(peerId);
    },
    [removePeer]
  );
  cleanupPeerRef.current = cleanupPeer;

  const cleanupAll = useCallback(() => {
    closeAll();
    setActivePeerIds([]);
    setRemoteStreams([]);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setIsEnabled(false);
    setIsCameraOff(false);
    setIsConnecting(false);
    setError('');
    appliedRemoteAnswerRef.current.clear();
  }, [closeAll]);

  const enable = useCallback(async () => {
    if (!socket || !currentUser) return;
    if (isEnabled || joinAttemptRef.current) return;
    setIsConnecting(true);
    joinAttemptRef.current = true;
    try {
      const stream = await ensureLocalCamera();
      if (!stream) throw new Error('camera-failed');
      socket.emit('videochat-join', { roomId });
    } catch (e) {
      setError('Unable to access camera');
      setIsConnecting(false);
      joinAttemptRef.current = false;
      setIsEnabled(false);
    }
  }, [socket, currentUser, isEnabled, ensureLocalCamera, roomId]);

  const disable = useCallback(async () => {
    if (!socket) return;
    if (isEnabled) socket.emit('videochat-leave', { roomId });
    joinAttemptRef.current = false;
    cleanupAll();
  }, [socket, isEnabled, roomId, cleanupAll]);

  const toggleCamera = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const nextOff = !s.getVideoTracks()[0]?.enabled;
    s.getVideoTracks().forEach(t => (t.enabled = nextOff));
    setIsCameraOff(!isCameraOff);
    // If turning camera back on, ensure tracks are attached to existing peers (in case browsers dropped them)
    if (nextOff === true) return; // we just turned off
    // turning on
    for (const peerId of activePeerIds) {
      getOrCreatePeer(peerId, true).then(pc => {
        const existingSenders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
        const track = s.getVideoTracks()[0];
        if (!track) return;
        if (existingSenders.length === 0) {
          pc.addTrack(track, s);
        } else {
          try {
            existingSenders[0].replaceTrack(track);
          } catch {
            /* ignore */
          }
        }
      });
    }
  }, [activePeerIds, getOrCreatePeer, isCameraOff]);

  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleExistingPeers = ({ userIds }: { userIds: string[] }) => {
      const others = userIds.filter(id => id !== currentUser.id).slice(0, Math.max(0, maxParticipants - 1));
      if (!isEnabled) {
        setIsEnabled(true);
        setIsConnecting(false);
        joinAttemptRef.current = false;
      }
      others.sort().forEach(async id => {
        if (!activePeerIds.includes(id)) {
          const pc = await getOrCreatePeer(id, true);
          const local = await ensureLocalCamera();
          local.getVideoTracks().forEach(track => pc.addTrack(track, local));
          const offer = await pc.createOffer({ offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit('videochat-offer', { roomId, targetUserId: id, sdp: offer });
          setActivePeerIds(prev => (prev.includes(id) ? prev : [...prev, id]));
        }
      });
    };

    const handleOffer = async ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (fromUserId === currentUser.id) return;
      const pc = await getOrCreatePeer(fromUserId, false);
      if (pc.signalingState !== 'stable') return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const local = await ensureLocalCamera();
      local.getVideoTracks().forEach(t => pc.addTrack(t, local));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('videochat-answer', { roomId, targetUserId: fromUserId, sdp: answer });
      setActivePeerIds(prev => (prev.includes(fromUserId) ? prev : [...prev, fromUserId]));
    };

    const handleAnswer = async ({ fromUserId, sdp }: { fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
      if (appliedRemoteAnswerRef.current.has(fromUserId)) return;
      if (!activePeerIds.includes(fromUserId)) return;
      const pc = await getOrCreatePeer(fromUserId, true);
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      appliedRemoteAnswerRef.current.add(fromUserId);
    };

    const handleIce = async ({ fromUserId, candidate }: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = await getOrCreatePeer(fromUserId, false);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    };

    const handlePeerLeft = ({ userId }: { userId: string }) => {
      cleanupPeer(userId);
    };

    const handleVideoChatError = ({ error }: { error: string }) => {
      setError(error);
      toast.error('Video chat error', { description: error });
      if (joinAttemptRef.current) {
        setIsConnecting(false);
        joinAttemptRef.current = false;
      }
    };

    const handleCount = ({ roomId: r, count }: { roomId: string; count: number }) => {
      if (r === roomId) setPublicParticipantCount(count);
    };

    socket.on('videochat-existing-peers', handleExistingPeers);
    socket.on('videochat-offer-received', handleOffer);
    socket.on('videochat-answer-received', handleAnswer);
    socket.on('videochat-ice-candidate-received', handleIce);
    socket.on('videochat-peer-left', handlePeerLeft);
    socket.on('videochat-error', handleVideoChatError);
    socket.on('videochat-participant-count', handleCount);
    return () => {
      socket.off('videochat-existing-peers', handleExistingPeers);
      socket.off('videochat-offer-received', handleOffer);
      socket.off('videochat-answer-received', handleAnswer);
      socket.off('videochat-ice-candidate-received', handleIce);
      socket.off('videochat-peer-left', handlePeerLeft);
      socket.off('videochat-error', handleVideoChatError);
      socket.off('videochat-participant-count', handleCount);
    };
  }, [
    socket,
    currentUser,
    roomId,
    maxParticipants,
    isEnabled,
    activePeerIds,
    getOrCreatePeer,
    ensureLocalCamera,
    cleanupPeer,
  ]);

  useEffect(
    () => () => {
      cleanupAll();
    },
    [cleanupAll]
  );

  return {
    isEnabled,
    isCameraOff,
    isConnecting,
    error,
    activePeerIds,
    publicParticipantCount,
    remoteStreams,
    localStream: localStreamRef.current,
    enable,
    disable,
    toggleCamera,
  };
}
