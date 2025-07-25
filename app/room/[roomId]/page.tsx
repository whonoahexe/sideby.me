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
import { Chat } from '@/components/chat';
import { UserList } from '@/components/user-list';
import { VideoSetup } from '@/components/video-setup';
import { parseVideoUrl } from '@/lib/video-utils';
import { Room, User, ChatMessage } from '@/types';
import { Copy, Share2, Users, Video, AlertCircle, ExternalLink } from 'lucide-react';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [showHostDialog, setShowHostDialog] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const { socket, isConnected } = useSocket();
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const syncThresholdRef = useRef<number>(2); // 2 seconds threshold for sync
  const hasAttemptedJoinRef = useRef<boolean>(false);
  const lastControlActionRef = useRef<{ timestamp: number; type: string; userId: string | null }>({
    timestamp: 0,
    type: '',
    userId: null,
  });
  const lastPlayerTimeRef = useRef<number>(0);
  const syncCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupDataRef = useRef<{
    socket: any;
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
    (targetTime: number, isPlaying: boolean | null, timestamp: number, sourceUserId?: string) => {
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
        room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
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
          const videoPlayer = player as VideoPlayerRef;

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

      const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
      if (!player) return;

      const currentTime = player.getCurrentTime();
      const isPlaying = room.videoType === 'youtube' 
        ? youtubePlayerRef.current?.getPlayerState() === YT_STATES.PLAYING
        : !videoPlayerRef.current?.isPaused();

      // Send periodic sync to ensure everyone is in sync
      console.log(`🔄 Periodic sync check: ${currentTime.toFixed(2)}s, playing: ${isPlaying}`);
      socket.emit('sync-check', { 
        roomId, 
        currentTime, 
        isPlaying,
        timestamp: Date.now()
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
      setRoom(prev => {
        if (!prev) return null;
        const updatedUsers = prev.users.filter(u => u.id !== userId);

        // Check if any hosts remain after this user leaves
        const remainingHosts = updatedUsers.filter(u => u.isHost);

        if (remainingHosts.length === 0) {
          console.log('🚪 All hosts left the room, closing room...');
          // Show error message and redirect all remaining users
          setError('All hosts have left the room. Redirecting to home page...');
          setTimeout(() => {
            router.push('/');
          }, 3000);
          return null; // Close the room
        }

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
      videoType: 'youtube' | 'mp4';
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

    const handleRoomError = ({ error }: { error: string }) => {
      console.error('🚨 Room error:', error);
      setError(error);
      setIsJoining(false);
      hasAttemptedJoinRef.current = false; // Reset so user can try again
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
      socket.off('room-error', handleRoomError);
      socket.off('error', handleSocketError);
    };
  }, [socket, isConnected, syncVideo]);

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

    // Start the join process
    console.log('🚀 Starting room join process...');
    setIsJoining(true);
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

    console.log('📝 Joining room with prompted name:', userName.trim());
    socket.emit('join-room', { roomId, userName: userName.trim() });
  }, [socket, isConnected, roomId, router, room, currentUser]);

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

  // Video event handlers for hosts
  const handleVideoPlay = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
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

    const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
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

    const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
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

  const handleVideoControlAttempt = () => {
    if (!currentUser?.isHost) {
      setShowHostDialog(true);
    }
  };

  const handleSetVideo = (videoUrl: string) => {
    if (!socket || !currentUser?.isHost) return;
    socket.emit('set-video', { roomId, videoUrl });
  };

  const handleSendMessage = (message: string) => {
    if (!socket) return;
    socket.emit('send-message', { roomId, message });
  };

  const handlePromoteUser = (userId: string) => {
    if (!socket || !currentUser?.isHost) return;
    socket.emit('promote-host', { roomId, userId });
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
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
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Room {roomId}</span>
                {currentUser.isHost && <Badge variant="default">Host</Badge>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Created by {room.hostName} • {room.users.filter(u => u.isHost).length} host
                {room.users.filter(u => u.isHost).length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={copyRoomId}>
                <Copy className="mr-2 h-4 w-4" />
                Copy ID
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
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{syncError}</span>
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
                          : 'inset-x-0 bottom-0 h-12' // Only cover bottom controls for regular video
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
                        {parsedVideo.type === 'youtube' ? 'YouTube' : 'Video File'}
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
          />
        </div>
      </div>

      {/* Host Control Dialog */}
      <Dialog open={showHostDialog} onOpenChange={setShowHostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Host Controls Only</DialogTitle>
            <DialogDescription>
              Only hosts can control video playback. You can watch along and use the chat to
              communicate. Ask a host to promote you if you need video controls.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setShowHostDialog(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
