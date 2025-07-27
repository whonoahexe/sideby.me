'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface HLSPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  getCurrentTime: () => number;
  seekTo: (time: number) => void;
  isPaused: () => boolean;
  getDuration: () => number;
}

interface HLSPlayerProps {
  src: string;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: () => void;
  onLoadedMetadata?: () => void;
  onTimeUpdate?: () => void;
  className?: string;
}

const HLSPlayer = forwardRef<HLSPlayerRef, HLSPlayerProps>(
  ({ src, onPlay, onPause, onSeeked, onLoadedMetadata, onTimeUpdate, className = '' }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<{ destroy: () => void } | null>(null);

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
          } catch (error) {
            console.error('Error playing HLS video:', error);
          }
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      isPaused: () => {
        return videoRef.current?.paused ?? true;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      // Check if HLS.js is supported
      const loadHLS = async () => {
        try {
          // Dynamically import HLS.js
          const { default: Hls } = await import('hls.js');

          if (Hls.isSupported()) {
            // Use HLS.js for browsers that don't support HLS natively
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });

            hlsRef.current = hls as { destroy: () => void };
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log('📺 HLS manifest loaded');
            });

            hls.on(Hls.Events.ERROR, (_event: unknown, data: unknown) => {
              console.error('HLS error:', data);
              const errorData = data as { fatal?: boolean; type?: string };
              if (errorData.fatal) {
                switch (errorData.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('Fatal network error encountered, try to recover');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('Fatal media error encountered, try to recover');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('Fatal error, cannot recover');
                    hls.destroy();
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = src;
            console.log('📺 Using native HLS support');
          } else {
            console.error('HLS is not supported in this browser');
          }
        } catch (error) {
          console.error('Failed to load HLS.js:', error);
          // Fallback to trying native support
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
          }
        }
      };

      loadHLS();

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src]);

    const handlePlay = () => {
      console.log('🎬 HLS video started playing');
      onPlay?.();
    };

    const handlePause = () => {
      console.log('⏸️ HLS video paused');
      onPause?.();
    };

    const handleSeeked = () => {
      console.log('🎯 HLS video seeked to:', videoRef.current?.currentTime);
      onSeeked?.();
    };

    const handleLoadedMetadata = () => {
      console.log('📊 HLS video metadata loaded');
      onLoadedMetadata?.();
    };

    const handleTimeUpdate = () => {
      onTimeUpdate?.();
    };

    return (
      <video
        ref={videoRef}
        className={`${className}`}
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        preload="metadata"
      />
    );
  }
);

HLSPlayer.displayName = 'HLSPlayer';

export { HLSPlayer };
