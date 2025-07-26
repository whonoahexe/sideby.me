'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSocket } from '@/hooks/use-socket';
import { YouTubePlayer, YouTubePlayerRef, YT_STATES } from '@/components/youtube-player';
import { VideoPlayer, VideoPlayerRef } from '@/components/video-player';
import { HLSPlayer, HLSPlayerRef } from '@/components/hls-player';
import { Chat } from '@/components/chat';
import { UserList } from '@/components/user-list';
import { VideoSetup } from '@/components/video-setup';
import { parseVideoUrl } from '@/lib/video-utils';
import { Room, User, ChatMessage, TypingUser } from '@/types';
import { Copy, Share2, Users, Video, AlertCircle, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [error, setError] = useState('');
  const [showHostDialog, setShowHostDialog] = useState(false);
  const [showGuestInfoBanner, setShowGuestInfoBanner] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [lastJoinAttempt, setLastJoinAttempt] = useState<number>(0);

  const { socket, isConnected } = useSocket();
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const hlsPlayerRef = useRef<HLSPlayerRef>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const hasAttemptedJoinRef = useRef<boolean>(false);
  const lastControlActionRef = useRef<{ timestamp: number; type: string; userId: string | null }>({
    timestamp: 0,
    type: '',
    userId: null,
  });
  const lastPlayerTimeRef = useRef<number>(0);
  const syncCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownClosureToastRef = useRef<boolean>(false);
  const cleanupDataRef = useRef<{
    socket: typeof socket;
    isConnected: boolean;
    roomId: string;
    room: Room | null;
    currentUser: User | null;
  }>({
    socket: null,
    isConnected: false,
    roomId: '',
    room: null,
    currentUser: null,
  });

  // Sync video playback
  const syncVideo = useCallback(
    (targetTime: number, isPlaying: boolean | null, timestamp: number) => {
      if (!room || !currentUser) return;

      // Don't sync if this user just performed the action (prevent feedback loop)
      const now = Date.now();
      const timeSinceLastAction = now - lastControlActionRef.current.timestamp;
      if (
        lastControlActionRef.current.userId === currentUser.id &&
        timeSinceLastAction < 500 // Reduced to 500ms for faster sync
      ) {
        console.log('🔄 Skipping sync - user just performed this action');
        return;
      }

      const player =
        room.videoType === 'youtube'
          ? youtubePlayerRef.current
          : room.videoType === 'm3u8'
            ? hlsPlayerRef.current
            : videoPlayerRef.current;
      if (!player) return;

      const timeDiff = (now - timestamp) / 1000;
      const adjustedTime = targetTime + (isPlaying ? timeDiff : 0);

      // Check if we need to sync
      const currentTime = player.getCurrentTime();
      const syncDiff = Math.abs(currentTime - adjustedTime);

      // Reduced threshold for better sync accuracy
      if (syncDiff > 1.5) {
        console.log(
          `🎬 Syncing video: ${syncDiff.toFixed(2)}s difference, seeking to ${adjustedTime.toFixed(2)}s`
        );
        player.seekTo(adjustedTime);
        lastSyncTimeRef.current = now;
        lastPlayerTimeRef.current = adjustedTime;
      }

      // Handle play/pause state
      if (isPlaying !== null) {
        if (room.videoType === 'youtube') {
          const ytPlayer = player as YouTubePlayerRef;
          const currentState = ytPlayer.getPlayerState();

          if (isPlaying && currentState !== YT_STATES.PLAYING) {
            console.log('▶️ Syncing play state');
            ytPlayer.play();
          } else if (!isPlaying && currentState === YT_STATES.PLAYING) {
            console.log('⏸️ Syncing pause state');
            ytPlayer.pause();
          }
        } else {
          // Handle both MP4 and HLS players (they have the same interface)
          const videoPlayer = player as VideoPlayerRef | HLSPlayerRef;

          if (isPlaying && videoPlayer.isPaused()) {
            console.log('▶️ Syncing play state');
            videoPlayer.play();
          } else if (!isPlaying && !videoPlayer.isPaused()) {
            console.log('⏸️ Syncing pause state');
            videoPlayer.pause();
          }
        }
      }
    },
    [room, currentUser]
  );

  // Periodic sync check for hosts to ensure everyone stays in sync
  const startSyncCheck = useCallback(() => {
    if (syncCheckIntervalRef.current) {
      clearInterval(syncCheckIntervalRef.current);
    }

    syncCheckIntervalRef.current = setInterval(() => {
      if (!room || !currentUser?.isHost || !socket) return;

      const player =
        room.videoType === 'youtube'
          ? youtubePlayerRef.current
          : room.videoType === 'm3u8'
            ? hlsPlayerRef.current
            : videoPlayerRef.current;
      if (!player) return;

      const currentTime = player.getCurrentTime();
      const isPlaying =
        room.videoType === 'youtube'
          ? youtubePlayerRef.current?.getPlayerState() === YT_STATES.PLAYING
          : room.videoType === 'm3u8'
            ? !hlsPlayerRef.current?.isPaused()
            : !videoPlayerRef.current?.isPaused();

      // Send periodic sync to ensure everyone is in sync
      console.log(`🔄 Periodic sync check: ${currentTime.toFixed(2)}s, playing: ${isPlaying}`);
      socket.emit('sync-check', {
        roomId,
        currentTime,
        isPlaying,
        timestamp: Date.now(),
      });
    }, 5000); // Check every 5 seconds
  }, [room, currentUser, socket, roomId]);

  const stopSyncCheck = useCallback(() => {
    if (syncCheckIntervalRef.current) {
      clearInterval(syncCheckIntervalRef.current);
      syncCheckIntervalRef.current = null;
    }
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleRoomJoined = ({ room: joinedRoom, user }: { room: Room; user: User }) => {
      console.log('✅ Room joined successfully:', {
        room: joinedRoom.id,
        user: user.name,
        isHost: user.isHost,
      });
      setRoom(joinedRoom);
      setCurrentUser(user);
      setError('');
      setIsJoining(false);
      hasAttemptedJoinRef.current = false; // Reset for potential future rejoins

      // Show info banner for guests when joining a room with video
      if (!user.isHost && joinedRoom.videoUrl) {
        setShowGuestInfoBanner(true);
        // Auto-hide banner after 5 seconds
        setTimeout(() => setShowGuestInfoBanner(false), 5000);
      }
    };

    const handleUserJoined = ({ user }: { user: User }) => {
      setRoom(prev => {
        if (!prev) return null;
        // Check if user already exists to prevent duplicates
        const existingUserIndex = prev.users.findIndex(u => u.id === user.id);
        if (existingUserIndex >= 0) {
          console.log('🔄 User already exists, updating:', user.name);
          const updatedUsers = [...prev.users];
          updatedUsers[existingUserIndex] = user;
          return { ...prev, users: updatedUsers };
        }
        console.log('👋 New user joined:', user.name);
        return { ...prev, users: [...prev.users, user] };
      });
    };

    const handleUserLeft = ({ userId }: { userId: string }) => {
      // Remove user from typing list when they leave
      setTypingUsers(prev => prev.filter(user => user.userId !== userId));

      setRoom(prev => {
        if (!prev) return null;
        const updatedUsers = prev.users.filter(u => u.id !== userId);

        // Just update the room state - let the server handle room closure logic
        return { ...prev, users: updatedUsers };
      });
    };

    const handleUserPromoted = ({ userId, userName }: { userId: string; userName: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        const updatedUsers = prev.users.map(user =>
          user.id === userId ? { ...user, isHost: true } : user
        );
        return { ...prev, users: updatedUsers };
      });

      // If the promoted user is the current user, update their state too
      setCurrentUser(prev => {
        if (prev && prev.id === userId) {
          console.log('🎉 You have been promoted to host!');
          return { ...prev, isHost: true };
        }
        return prev;
      });

      // Show promotion notification
      console.log(`👑 ${userName} has been promoted to host`);
    };

    const handleVideoSet = ({
      videoUrl,
      videoType,
    }: {
      videoUrl: string;
      videoType: 'youtube' | 'mp4' | 'm3u8';
    }) => {
      setRoom(prev =>
        prev
          ? {
              ...prev,
              videoUrl,
              videoType,
              videoState: {
                isPlaying: false,
                currentTime: 0,
                duration: 0,
                lastUpdateTime: Date.now(),
              },
            }
          : null
      );

      // Show info banner for guests when video is set
      if (currentUser && !currentUser.isHost) {
        setShowGuestInfoBanner(true);
        // Auto-hide banner after 5 seconds
        setTimeout(() => setShowGuestInfoBanner(false), 5000);
      }
    };

    const handleVideoPlayed = ({
      currentTime,
      timestamp,
    }: {
      currentTime: number;
      timestamp: number;
    }) => {
      syncVideo(currentTime, true, timestamp);
    };

    const handleVideoPaused = ({
      currentTime,
      timestamp,
    }: {
      currentTime: number;
      timestamp: number;
    }) => {
      syncVideo(currentTime, false, timestamp);
    };

    const handleVideoSeeked = ({
      currentTime,
      timestamp,
    }: {
      currentTime: number;
      timestamp: number;
    }) => {
      syncVideo(currentTime, null, timestamp);
    };

    const handleSyncUpdate = ({
      currentTime,
      isPlaying,
      timestamp,
    }: {
      currentTime: number;
      isPlaying: boolean;
      timestamp: number;
    }) => {
      if (currentUser?.isHost) {
        // Hosts don't sync to sync-updates to avoid conflicts
        return;
      }
      console.log('📡 Received sync update from host');
      syncVideo(currentTime, isPlaying, timestamp);
    };

    const handleNewMessage = ({ message }: { message: ChatMessage }) => {
      setMessages(prev => [...prev, message]);
    };

    const handleUserTyping = ({ userId, userName }: { userId: string; userName: string }) => {
      if (userId === currentUser?.id) return; // Don't show own typing

      setTypingUsers(prev => {
        const existing = prev.find(user => user.userId === userId);
        if (existing) {
          return prev.map(user =>
            user.userId === userId ? { ...user, timestamp: Date.now() } : user
          );
        }
        return [...prev, { userId, userName, timestamp: Date.now() }];
      });
    };

    const handleUserStoppedTyping = ({ userId }: { userId: string }) => {
      setTypingUsers(prev => prev.filter(user => user.userId !== userId));
    };

    const handleRoomError = ({ error }: { error: string }) => {
      console.error('🚨 Room error:', error);

      // Check if this is a room closure message - redirect regardless of current state
      if (error.includes('All hosts have left') || error.includes('Redirecting to home page')) {
        console.log('🚪 Room closed by host departure, redirecting to home...');

        // Prevent duplicate toasts
        if (hasShownClosureToastRef.current) {
          console.log('🛡️ Closure toast already shown, skipping duplicate');
          return;
        }
        hasShownClosureToastRef.current = true;

        // Show toast notification
        toast.error('Room Closed', {
          description: 'All hosts have left the room. You will be redirected to the home page.',
          duration: 4000,
        });

        // Redirect after a short delay to allow toast to show
        setTimeout(() => {
          router.push('/');
        }, 1500);
        return;
      }

      // If we're already in a room (successful join), don't reset flags
      // This prevents duplicate join attempts after a successful join
      if (room && currentUser) {
        console.log('🛡️ Ignoring room error - already successfully in room');
        return;
      }

      setError(error);
      setIsJoining(false);
      hasAttemptedJoinRef.current = false; // Reset so user can try again
      setLastJoinAttempt(0); // Reset join attempt debounce
    };

    const handleSocketError = ({ error }: { error: string }) => {
      setSyncError(error);
      setTimeout(() => setSyncError(''), 5000);
    };

    socket.on('room-joined', handleRoomJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('user-promoted', handleUserPromoted);
    socket.on('video-set', handleVideoSet);
    socket.on('video-played', handleVideoPlayed);
    socket.on('video-paused', handleVideoPaused);
    socket.on('video-seeked', handleVideoSeeked);
    socket.on('sync-update', handleSyncUpdate);
    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);
    socket.on('room-error', handleRoomError);
    socket.on('error', handleSocketError);

    return () => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('user-promoted', handleUserPromoted);
      socket.off('video-set', handleVideoSet);
      socket.off('video-played', handleVideoPlayed);
      socket.off('video-paused', handleVideoPaused);
      socket.off('video-seeked', handleVideoSeeked);
      socket.off('sync-update', handleSyncUpdate);
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
      socket.off('room-error', handleRoomError);
      socket.off('error', handleSocketError);
    };
  }, [socket, isConnected, syncVideo, router, currentUser]);

  // Join room on mount
  useEffect(() => {
    if (!socket || !isConnected || !roomId) {
      console.log('🚫 Not ready to join:', { socket: !!socket, isConnected, roomId });
      return;
    }

    // Check if we're already in a room
    if (room && currentUser) {
      console.log('🔄 Already in room, skipping join');
      return;
    }

    // Prevent multiple join attempts (especially important for React Strict Mode)
    if (isJoining || hasAttemptedJoinRef.current) {
      console.log('⏳ Join already in progress or attempted, skipping');
      return;
    }

    // Check if socket is already in this room (additional safety check)
    if ((socket as any).rooms?.has(roomId)) {
      console.log('🏠 Socket already in room, skipping join');
      hasAttemptedJoinRef.current = true;
      return;
    }

    // Prevent rapid successive join attempts (debounce)
    const now = Date.now();
    if (now - lastJoinAttempt < 2000) {
      // 2 second cooldown
      console.log('🕒 Too soon since last join attempt, skipping');
      return;
    }

    // Start the join process
    console.log('🚀 Starting room join process...');
    setIsJoining(true);
    setLastJoinAttempt(now);
    hasAttemptedJoinRef.current = true;

    // Check if this user is the room creator first
    const creatorData = sessionStorage.getItem('room-creator');
    if (creatorData) {
      try {
        const { roomId: creatorRoomId, hostName, hostToken, timestamp } = JSON.parse(creatorData);

        // Check if the data is recent (within 5 minutes) and for the correct room
        if (creatorRoomId === roomId && Date.now() - timestamp < 300000) {
          console.log('👑 Room creator detected, joining as host:', hostName);
          // Clear the creator data to prevent reuse
          sessionStorage.removeItem('room-creator');

          // Room creators join their own room with host token
          socket.emit('join-room', { roomId, userName: hostName, hostToken });
          return;
        } else {
          console.log('🗑️ Cleaning up old creator data');
          sessionStorage.removeItem('room-creator');
        }
      } catch (error) {
        console.error('Error parsing creator data:', error);
        sessionStorage.removeItem('room-creator');
      }
    }

    // Check if user came from join page (from sessionStorage)
    const joinData = sessionStorage.getItem('join-data');
    if (joinData) {
      try {
        const { roomId: joinRoomId, userName, timestamp } = JSON.parse(joinData);

        // Check if the data is recent (within 5 minutes) and for the correct room
        if (joinRoomId === roomId && Date.now() - timestamp < 300000) {
          // Clear the data to prevent reuse
          sessionStorage.removeItem('join-data');

          console.log('👤 Joining with stored data:', userName);
          socket.emit('join-room', { roomId, userName });
          return;
        } else {
          console.log('🗑️ Cleaning up old join data');
          // Clean up old data
          sessionStorage.removeItem('join-data');
        }
      } catch (error) {
        console.error('Error parsing join data:', error);
        sessionStorage.removeItem('join-data');
      }
    }

    // If we don't have stored join data, prompt for name
    // This handles direct URL access
    console.log('❓ No stored user data, prompting for name');
    const userName = prompt('Enter your name to join the room:');
    if (!userName || !userName.trim()) {
      console.log('❌ No name provided, redirecting to join page');
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
      router.push('/join');
      return;
    }

    // Validate name format
    const trimmedName = userName.trim();
    if (trimmedName.length < 2) {
      alert('Name must be at least 2 characters long. Please try again.');
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
      router.push('/join');
      return;
    }

    if (trimmedName.length > 50) {
      alert('Name must be 50 characters or less. Please try again.');
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
      router.push('/join');
      return;
    }

    if (!/^[a-zA-Z0-9\s\-_.!?]+$/.test(trimmedName)) {
      alert(
        'Name can only contain letters, numbers, spaces, and basic punctuation (- _ . ! ?). Please try again.'
      );
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
      router.push('/join');
      return;
    }

    console.log('📝 Joining room with prompted name:', trimmedName);
    socket.emit('join-room', { roomId, userName: trimmedName });
  }, [socket, isConnected, roomId, router, room, currentUser, isJoining, lastJoinAttempt]);

  // Update cleanup data ref whenever values change
  useEffect(() => {
    cleanupDataRef.current = {
      socket,
      isConnected,
      roomId,
      room,
      currentUser,
    };
  }, [socket, isConnected, roomId, room, currentUser]);

  // Cleanup when leaving the room page (stable effect with no dependencies)
  useEffect(() => {
    return () => {
      // Use ref values to avoid dependencies
      const { socket, isConnected, roomId, room, currentUser } = cleanupDataRef.current;
      if (socket && isConnected && room && currentUser) {
        console.log('🚪 Component unmounting, leaving room...');
        socket.emit('leave-room', { roomId });
      }
      // Stop sync check on unmount
      stopSyncCheck();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - effect only runs once

  // Start/stop sync check based on host status
  useEffect(() => {
    if (currentUser?.isHost && room?.videoUrl) {
      console.log('🎯 Starting sync check - user is host');
      startSyncCheck();
    } else {
      console.log('🛑 Stopping sync check - user is not host or no video');
      stopSyncCheck();
    }

    return () => {
      stopSyncCheck();
    };
  }, [currentUser?.isHost, room?.videoUrl, startSyncCheck, stopSyncCheck]);

  const handleVideoControlAttempt = useCallback(() => {
    if (!currentUser?.isHost) {
      setShowHostDialog(true);
      // Also hide the guest banner when they interact to show the detailed modal
      setShowGuestInfoBanner(false);
    }
  }, [currentUser?.isHost]);

  // Keyboard shortcut listener for guests
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts if there's a video and user is not a host
      if (!room?.videoUrl || currentUser?.isHost) return;

      // Don't block shortcuts if user is typing in an input field
      const target = event.target as HTMLElement;
      const isTypingInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.getAttribute('role') === 'textbox';

      if (isTypingInInput) return;

      // Common video shortcuts that guests might try
      const videoShortcuts = [
        ' ',
        'k',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'j',
        'l',
        'f',
        'm',
      ];

      if (videoShortcuts.includes(event.key)) {
        // Prevent default behavior and show dialog
        event.preventDefault();
        handleVideoControlAttempt();
      }
    };

    // Only add listener if user is a guest with video present
    if (room?.videoUrl && currentUser && !currentUser.isHost) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [room?.videoUrl, currentUser?.isHost, currentUser, handleVideoControlAttempt]);

  // Video event handlers for hosts
  const handleVideoPlay = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player =
      room.videoType === 'youtube'
        ? youtubePlayerRef.current
        : room.videoType === 'm3u8'
          ? hlsPlayerRef.current
          : videoPlayerRef.current;
    if (!player) return;

    const currentTime = player.getCurrentTime();

    // Track that this user performed the action
    lastControlActionRef.current = {
      timestamp: Date.now(),
      type: 'play',
      userId: currentUser.id,
    };

    socket.emit('play-video', { roomId, currentTime });
  }, [room, currentUser, socket, roomId]);

  const handleVideoPause = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player =
      room.videoType === 'youtube'
        ? youtubePlayerRef.current
        : room.videoType === 'm3u8'
          ? hlsPlayerRef.current
          : videoPlayerRef.current;
    if (!player) return;

    const currentTime = player.getCurrentTime();

    // Track that this user performed the action
    lastControlActionRef.current = {
      timestamp: Date.now(),
      type: 'pause',
      userId: currentUser.id,
    };

    socket.emit('pause-video', { roomId, currentTime });
  }, [room, currentUser, socket, roomId]);

  const handleVideoSeek = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player =
      room.videoType === 'youtube'
        ? youtubePlayerRef.current
        : room.videoType === 'm3u8'
          ? hlsPlayerRef.current
          : videoPlayerRef.current;
    if (!player) return;

    const currentTime = player.getCurrentTime();

    // Track that this user performed the action
    lastControlActionRef.current = {
      timestamp: Date.now(),
      type: 'seek',
      userId: currentUser.id,
    };

    socket.emit('seek-video', { roomId, currentTime });
  }, [room, currentUser, socket, roomId]);

  const handleYouTubeStateChange = useCallback(
    (state: number) => {
      if (!currentUser?.isHost || !socket) return;

      const player = youtubePlayerRef.current;
      if (!player) return;

      const currentTime = player.getCurrentTime();

      if (state === YT_STATES.PLAYING) {
        // Check if this is a seek by comparing with last known time
        const timeDiff = Math.abs(currentTime - lastPlayerTimeRef.current);
        if (timeDiff > 1) {
          // Likely a seek happened before play
          console.log(`🎯 Detected seek to ${currentTime.toFixed(2)}s before play`);
          lastControlActionRef.current = {
            timestamp: Date.now(),
            type: 'seek',
            userId: currentUser.id,
          };
          socket.emit('seek-video', { roomId, currentTime });
        }

        // Track the play action
        lastControlActionRef.current = {
          timestamp: Date.now(),
          type: 'play',
          userId: currentUser.id,
        };
        lastPlayerTimeRef.current = currentTime;
        socket.emit('play-video', { roomId, currentTime });
      } else if (state === YT_STATES.PAUSED) {
        // Track the pause action
        lastControlActionRef.current = {
          timestamp: Date.now(),
          type: 'pause',
          userId: currentUser.id,
        };
        lastPlayerTimeRef.current = currentTime;
        socket.emit('pause-video', { roomId, currentTime });
      } else if (state === YT_STATES.BUFFERING) {
        // Check for potential seek during buffering
        const timeDiff = Math.abs(currentTime - lastPlayerTimeRef.current);
        if (timeDiff > 1) {
          console.log(`🎯 Detected seek to ${currentTime.toFixed(2)}s during buffering`);
          lastControlActionRef.current = {
            timestamp: Date.now(),
            type: 'seek',
            userId: currentUser.id,
          };
          lastPlayerTimeRef.current = currentTime;
          socket.emit('seek-video', { roomId, currentTime });
        }
      }
    },
    [currentUser, socket, roomId]
  );

  const handleSetVideo = (videoUrl: string) => {
    if (!socket || !currentUser?.isHost) return;
    socket.emit('set-video', { roomId, videoUrl });
  };

  const handleSendMessage = (message: string) => {
    if (!socket) return;
    socket.emit('send-message', { roomId, message });
  };

  const handleTypingStart = () => {
    if (!socket) return;
    socket.emit('typing-start', { roomId });
  };

  const handleTypingStop = () => {
    if (!socket) return;
    socket.emit('typing-stop', { roomId });
  };

  const handlePromoteUser = (userId: string) => {
    if (!socket || !currentUser?.isHost) return;
    socket.emit('promote-host', { roomId, userId });
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const shareRoom = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join my Watch.With room',
        text: `Join me to watch videos together! Room ID: ${roomId}`,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push('/join')}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!room || !currentUser) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            <CardTitle>Joining Room</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">Connecting to room {roomId}...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const parsedVideo = room.videoUrl ? parseVideoUrl(room.videoUrl) : null;

  return (
    <div className="space-y-6">
      {/* Room Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Users className="h-5 w-5 flex-shrink-0" />
                <span className="break-all sm:break-normal">Room {roomId}</span>
                {currentUser.isHost && <Badge variant="default">Host</Badge>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Created by {room.hostName} • {room.users.filter(u => u.isHost).length} host
                {room.users.filter(u => u.isHost).length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={copyRoomId}
                className="relative overflow-hidden"
              >
                {showCopied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {showCopied ? 'Copied!' : 'Copy ID'}
              </Button>
              <Button variant="outline" size="sm" onClick={shareRoom}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sync Error */}
      {syncError && (
        <Card className="border-destructive">
          <CardContent>
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{syncError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guest Info Banner */}
      {showGuestInfoBanner && !currentUser.isHost && room.videoUrl && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                <Video className="h-4 w-4" />
                <span className="text-sm font-medium">
                  You&apos;re watching as a guest - only hosts can control playback
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHostDialog(true)}
                  className="text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  Learn More
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGuestInfoBanner(false)}
                  className="text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  ✕
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-3">
          {/* Video Player */}
          {room.videoUrl && parsedVideo ? (
            <Card>
              <CardContent className="p-6">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                  {parsedVideo.type === 'youtube' ? (
                    <YouTubePlayer
                      ref={youtubePlayerRef}
                      videoId={parsedVideo.embedUrl.split('/embed/')[1]?.split('?')[0] || ''}
                      onStateChange={handleYouTubeStateChange}
                      className="h-full w-full"
                    />
                  ) : parsedVideo.type === 'm3u8' ? (
                    <HLSPlayer
                      ref={hlsPlayerRef}
                      src={parsedVideo.embedUrl}
                      onPlay={handleVideoPlay}
                      onPause={handleVideoPause}
                      onSeeked={handleVideoSeek}
                      className="h-full w-full"
                    />
                  ) : (
                    <VideoPlayer
                      ref={videoPlayerRef}
                      src={parsedVideo.embedUrl}
                      onPlay={handleVideoPlay}
                      onPause={handleVideoPause}
                      onSeeked={handleVideoSeek}
                      className="h-full w-full"
                    />
                  )}

                  {/* Block video controls for non-hosts */}
                  {!currentUser.isHost && (
                    <div
                      className={`absolute z-10 ${
                        parsedVideo.type === 'youtube'
                          ? 'inset-0' // Cover entire YouTube video (controls are everywhere)
                          : 'inset-x-0 bottom-0 h-12' // Only cover bottom controls for regular video and HLS
                      }`}
                      onClick={handleVideoControlAttempt}
                      title="Only hosts can control video playback"
                    />
                  )}
                </div>

                {room.videoUrl && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {parsedVideo.type === 'youtube'
                          ? 'YouTube'
                          : parsedVideo.type === 'm3u8'
                            ? 'HLS Stream'
                            : 'Video File'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(room.videoUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <VideoSetup
              onVideoSet={handleSetVideo}
              isHost={currentUser.isHost}
              hasVideo={!!room.videoUrl}
              videoUrl={room.videoUrl}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <UserList
            users={room.users}
            currentUserId={currentUser.id}
            currentUserIsHost={currentUser.isHost}
            onPromoteUser={handlePromoteUser}
          />

          <Chat
            messages={messages}
            currentUserId={currentUser.id}
            onSendMessage={handleSendMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            typingUsers={typingUsers}
          />
        </div>
      </div>

      {/* Host Control Dialog */}
      <Dialog open={showHostDialog} onOpenChange={setShowHostDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Video className="h-5 w-5 text-blue-500" />
              <span>Video Control Information</span>
            </DialogTitle>
            <DialogDescription>
              Learn about video controls and permissions in Watch.with rooms.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Guest Permissions</h4>
              <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>• Watch videos in perfect sync with everyone</li>
                <li>• Use chat to communicate with other viewers</li>
                <li>• See who&apos;s currently watching</li>
                <li>• Request host promotion from current hosts</li>
              </ul>
            </div>

            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950">
              <h4 className="font-medium text-green-900 dark:text-green-100">Host Permissions</h4>
              <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-300">
                <li>• Control video playback (play, pause, seek)</li>
                <li>• Set or change the video URL</li>
                <li>• Promote other users to host</li>
                <li>• All guest permissions</li>
              </ul>
            </div>

            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
              <h4 className="font-medium text-amber-900 dark:text-amber-100">Need Controls?</h4>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Ask any current host to promote you using the crown button (👑) next to your name in
                the user list.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h4>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                These shortcuts work for hosts only:
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                <div>• Space/K - Play/Pause</div>
                <div>• ←/→ - Seek ±10s</div>
                <div>• J/L - Seek ±10s</div>
                <div>• ↑/↓ - Volume</div>
                <div>• F - Fullscreen</div>
                <div>• M - Mute</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowHostDialog(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
