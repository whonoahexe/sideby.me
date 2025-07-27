import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { YouTubePlayer, YouTubePlayerRef } from '@/components/video/youtube-player';
import { VideoPlayer, VideoPlayerRef } from '@/components/video/video-player';
import { HLSPlayer, HLSPlayerRef } from '@/components/video/hls-player';
import { Video, ExternalLink } from 'lucide-react';

interface VideoPlayerContainerProps {
  videoUrl: string;
  videoType: 'youtube' | 'mp4' | 'm3u8';
  videoId?: string;
  isHost: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeeked: () => void;
  onYouTubeStateChange: (state: number) => void;
  onControlAttempt: () => void;
  youtubePlayerRef: React.RefObject<YouTubePlayerRef | null>;
  videoPlayerRef: React.RefObject<VideoPlayerRef | null>;
  hlsPlayerRef: React.RefObject<HLSPlayerRef | null>;
}

export function VideoPlayerContainer({
  videoUrl,
  videoType,
  videoId,
  isHost,
  onPlay,
  onPause,
  onSeeked,
  onYouTubeStateChange,
  onControlAttempt,
  youtubePlayerRef,
  videoPlayerRef,
  hlsPlayerRef,
}: VideoPlayerContainerProps) {
  const getVideoTypeName = () => {
    switch (videoType) {
      case 'youtube':
        return 'YouTube';
      case 'm3u8':
        return 'HLS Stream';
      default:
        return 'Video File';
    }
  };

  const renderPlayer = () => {
    switch (videoType) {
      case 'youtube':
        return (
          <YouTubePlayer
            ref={youtubePlayerRef}
            videoId={videoId || ''}
            onStateChange={onYouTubeStateChange}
            className="h-full w-full"
          />
        );
      case 'm3u8':
        return (
          <HLSPlayer
            ref={hlsPlayerRef}
            src={videoUrl}
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={onSeeked}
            className="h-full w-full"
          />
        );
      default:
        return (
          <VideoPlayer
            ref={videoPlayerRef}
            src={videoUrl}
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={onSeeked}
            className="h-full w-full"
          />
        );
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          {renderPlayer()}

          {/* Block video controls for non-hosts */}
          {!isHost && (
            <div
              className={`absolute z-10 ${
                videoType === 'youtube'
                  ? 'inset-0' // Cover entire YouTube video (controls are everywhere)
                  : 'inset-x-0 bottom-0 h-12' // Only cover bottom controls for regular video and HLS
              }`}
              onClick={onControlAttempt}
              title="Only hosts can control video playback"
            />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{getVideoTypeName()}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.open(videoUrl, '_blank')}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
