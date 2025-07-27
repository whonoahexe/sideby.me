'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface VideoPlayerProps {
  src: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onSeeked?: () => void;
  className?: string;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, onReady, onPlay, onPause, onTimeUpdate, onSeeked, className }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
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
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        onReady?.();
      };

      const handlePlay = () => {
        onPlay?.();
      };

      const handlePause = () => {
        onPause?.();
      };

      const handleTimeUpdate = () => {
        if (video && onTimeUpdate) {
          onTimeUpdate(video.currentTime, video.duration);
        }
      };

      const handleSeeked = () => {
        onSeeked?.();
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('seeked', handleSeeked);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('seeked', handleSeeked);
      };
    }, [onReady, onPlay, onPause, onTimeUpdate, onSeeked]);

    return (
      <video
        ref={videoRef}
        src={src}
        controls
        className={className}
        crossOrigin="anonymous"
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
