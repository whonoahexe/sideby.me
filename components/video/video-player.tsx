'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useVideoSubtitleTracks } from '@/hooks/use-video-subtitle-tracks';
import type { SubtitleTrack } from '@/types/schemas';

interface VideoPlayerProps {
  src: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onSeeked?: () => void;
  className?: string;
  isHost?: boolean;
  subtitleTracks?: SubtitleTrack[];
  activeSubtitleTrack?: string;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
  getVideoElement: () => HTMLVideoElement | null;
  debugSubtitles: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      src,
      onReady,
      onPlay,
      onPause,
      onTimeUpdate,
      onSeeked,
      className,
      isHost = false,
      subtitleTracks = [],
      activeSubtitleTrack,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const programmaticActionRef = useRef(false);

    // Use dedicated hook for subtitle track management
    const { debugSubtitles } = useVideoSubtitleTracks({
      videoElement: videoRef.current,
      subtitleTracks,
      activeSubtitleTrack,
    });

    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          programmaticActionRef.current = true;
          videoRef.current.play().catch(console.error);
        }
      },
      pause: () => {
        if (videoRef.current) {
          programmaticActionRef.current = true;
          videoRef.current.pause();
        }
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
          programmaticActionRef.current = true;
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
      isPaused: () => {
        return videoRef.current?.paused ?? true;
      },
      getVideoElement: () => {
        return videoRef.current;
      },
      debugSubtitles,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        console.log('Video metadata loaded:', video.duration);
        onReady?.();
      };

      const handlePlay = () => {
        console.log('Video play event', { programmatic: programmaticActionRef.current, isHost });
        // Only emit if this is a user action (not programmatic) and user is host
        if (!programmaticActionRef.current && isHost) {
          onPlay?.();
        }
        programmaticActionRef.current = false;
      };

      const handlePause = () => {
        console.log('Video pause event', { programmatic: programmaticActionRef.current, isHost });
        // Only emit if this is a user action (not programmatic) and user is host
        if (!programmaticActionRef.current && isHost) {
          onPause?.();
        }
        programmaticActionRef.current = false;
      };

      const handleTimeUpdate = () => {
        if (video && onTimeUpdate) {
          onTimeUpdate(video.currentTime, video.duration);
        }
      };

      const handleSeeked = () => {
        console.log('Video seeked to:', video.currentTime, { programmatic: programmaticActionRef.current, isHost });
        // Only emit if this is a user action (not programmatic) and user is host
        if (!programmaticActionRef.current && isHost) {
          onSeeked?.();
        }
        programmaticActionRef.current = false;
      };

      const handleError = () => {
        console.error('Video error:', video.error);
        console.error('Error details:', {
          code: video.error?.code,
          message: video.error?.message,
          src: video.src,
        });
      };

      const handleCanPlay = () => {
        console.log('Video can start playing');
      };

      const handleLoadStart = () => {
        console.log('Video load started for:', video.src);
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('error', handleError);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadstart', handleLoadStart);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadstart', handleLoadStart);
      };
    }, [onReady, onPlay, onPause, onTimeUpdate, onSeeked, isHost]);

    return (
      <video
        ref={videoRef}
        src={src}
        controls={false} // Always use custom controls
        className={className}
        preload="metadata"
        playsInline
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture={!isHost}
        crossOrigin="anonymous"
      >
        Your browser does not support the video tag.
      </video>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
