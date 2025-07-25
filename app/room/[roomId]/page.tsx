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
import { parseVideoUrl, calculateCurrentTime } from '@/lib/video-utils';
import { Room, User, ChatMessage, VideoState } from '@/types';
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

  const { socket, isConnected } = useSocket();
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const syncThresholdRef = useRef<number>(2); // 2 seconds threshold for sync

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleRoomJoined = ({ room: joinedRoom, user }: { room: Room; user: User }) => {
      setRoom(joinedRoom);
      setCurrentUser(user);
      setError('');
    };

    const handleRoomCreated = ({ room: createdRoom }: { room: Room }) => {
      // When room is created, the creator is automatically the host
      setRoom(createdRoom);
      const hostUser = createdRoom.users.find(u => u.isHost);
      if (hostUser) {
        setCurrentUser(hostUser);
        setError('');
      }
    };

    const handleUserJoined = ({ user }: { user: User }) => {
      setRoom(prev => (prev ? { ...prev, users: [...prev.users, user] } : null));
    };

    const handleUserLeft = ({ userId }: { userId: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        const updatedUsers = prev.users.filter(u => u.id !== userId);

        // If host left, update the new host
        if (prev.hostId === userId && updatedUsers.length > 0) {
          const newHost = updatedUsers[0];
          return {
            ...prev,
            hostId: newHost.id,
            hostName: newHost.name,
            users: updatedUsers.map(u => (u.id === newHost.id ? { ...u, isHost: true } : u)),
          };
        }

        return { ...prev, users: updatedUsers };
      });
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

    const handleNewMessage = ({ message }: { message: ChatMessage }) => {
      setMessages(prev => [...prev, message]);
    };

    const handleRoomError = ({ error }: { error: string }) => {
      setError(error);
    };

    const handleSocketError = ({ error }: { error: string }) => {
      setSyncError(error);
      setTimeout(() => setSyncError(''), 5000);
    };

    socket.on('room-created', handleRoomCreated);
    socket.on('room-joined', handleRoomJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('video-set', handleVideoSet);
    socket.on('video-played', handleVideoPlayed);
    socket.on('video-paused', handleVideoPaused);
    socket.on('video-seeked', handleVideoSeeked);
    socket.on('new-message', handleNewMessage);
    socket.on('room-error', handleRoomError);
    socket.on('error', handleSocketError);

    return () => {
      socket.off('room-created', handleRoomCreated);
      socket.off('room-joined', handleRoomJoined);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('video-set', handleVideoSet);
      socket.off('video-played', handleVideoPlayed);
      socket.off('video-paused', handleVideoPaused);
      socket.off('video-seeked', handleVideoSeeked);
      socket.off('new-message', handleNewMessage);
      socket.off('room-error', handleRoomError);
      socket.off('error', handleSocketError);
    };
  }, [socket, isConnected]);

  // Join room on mount
  useEffect(() => {
    if (!socket || !isConnected || !roomId) return;

    // Check if we're already in a room (page refresh case or coming from room creation)
    if (room && currentUser) return;

    // Check if this user created the room (from sessionStorage)
    const roomCreatorData = sessionStorage.getItem('room-creator');
    if (roomCreatorData) {
      try {
        const { roomId: createdRoomId, hostName, timestamp } = JSON.parse(roomCreatorData);

        // Check if the data is recent (within 1 minute) and for the correct room
        if (createdRoomId === roomId && Date.now() - timestamp < 60000) {
          // Clear the data to prevent reuse
          sessionStorage.removeItem('room-creator');

          // Use the stored host name to join as the creator
          socket.emit('join-room', { roomId, userName: hostName });
          return;
        } else {
          // Clean up old data
          sessionStorage.removeItem('room-creator');
        }
      } catch (error) {
        console.error('Error parsing room creator data:', error);
        sessionStorage.removeItem('room-creator');
      }
    }

    // If we don't have creator data, prompt for name
    // For demo purposes, we'll use a simple name prompt
    // In a real app, you'd have proper authentication
    const userName = prompt('Enter your name:');
    if (!userName) {
      router.push('/join');
      return;
    }

    socket.emit('join-room', { roomId, userName });
  }, [socket, isConnected, roomId, router, room, currentUser]);

  // Sync video playback
  const syncVideo = useCallback(
    (targetTime: number, isPlaying: boolean | null, timestamp: number) => {
      if (!room || !currentUser || currentUser.isHost) return;

      const player =
        room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
      if (!player) return;

      const now = Date.now();
      const timeDiff = (now - timestamp) / 1000;
      const adjustedTime = targetTime + (isPlaying ? timeDiff : 0);

      // Check if we need to sync
      const currentTime = player.getCurrentTime();
      const syncDiff = Math.abs(currentTime - adjustedTime);

      if (syncDiff > syncThresholdRef.current) {
        player.seekTo(adjustedTime);
        lastSyncTimeRef.current = now;
      }

      // Handle play/pause state
      if (isPlaying !== null) {
        if (room.videoType === 'youtube') {
          const ytPlayer = player as YouTubePlayerRef;
          const currentState = ytPlayer.getPlayerState();

          if (isPlaying && currentState !== YT_STATES.PLAYING) {
            ytPlayer.play();
          } else if (!isPlaying && currentState === YT_STATES.PLAYING) {
            ytPlayer.pause();
          }
        } else {
          const videoPlayer = player as VideoPlayerRef;

          if (isPlaying && videoPlayer.isPaused()) {
            videoPlayer.play();
          } else if (!isPlaying && !videoPlayer.isPaused()) {
            videoPlayer.pause();
          }
        }
      }
    },
    [room, currentUser]
  );

  // Video event handlers for hosts
  const handleVideoPlay = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
    if (!player) return;

    const currentTime = player.getCurrentTime();
    socket.emit('play-video', { roomId, currentTime });
  }, [room, currentUser, socket, roomId]);

  const handleVideoPause = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
    if (!player) return;

    const currentTime = player.getCurrentTime();
    socket.emit('pause-video', { roomId, currentTime });
  }, [room, currentUser, socket, roomId]);

  const handleVideoSeek = useCallback(() => {
    if (!room || !currentUser?.isHost || !socket) return;

    const player = room.videoType === 'youtube' ? youtubePlayerRef.current : videoPlayerRef.current;
    if (!player) return;

    const currentTime = player.getCurrentTime();
    socket.emit('seek-video', { roomId, currentTime });
  }, [room, currentUser, socket, roomId]);

  const handleYouTubeStateChange = useCallback(
    (state: number) => {
      if (!currentUser?.isHost) return;

      if (state === YT_STATES.PLAYING) {
        handleVideoPlay();
      } else if (state === YT_STATES.PAUSED) {
        handleVideoPause();
      }
    },
    [currentUser, handleVideoPlay, handleVideoPause]
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
              <p className="text-sm text-muted-foreground">Hosted by {room.hostName}</p>
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
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
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

                  {/* Overlay for non-hosts */}
                  {!currentUser.isHost && (
                    <div
                      className="absolute inset-0 z-10 cursor-pointer"
                      onClick={handleVideoControlAttempt}
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
          <UserList users={room.users} currentUserId={currentUser.id} />

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
              Only the host ({room.hostName}) can control video playback. You can watch along and
              use the chat to communicate.
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
