'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface HLSPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  getCurrentTime: () => number;
  seekTo: (time: number) => void;
  isPaused: () => boolean;
  getDuration: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}

interface HLSPlayerProps {
  src: string;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: () => void;
  onLoadedMetadata?: () => void;
  onTimeUpdate?: () => void;
  className?: string;
  isHost?: boolean;
}

const HLSPlayer = forwardRef<HLSPlayerRef, HLSPlayerProps>(
  ({ src, onPlay, onPause, onSeeked, onLoadedMetadata, onTimeUpdate, className = '', isHost = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<{ destroy: () => void } | null>(null);
    const programmaticActionRef = useRef(false);

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            programmaticActionRef.current = true;
            await videoRef.current.play();
          } catch (error) {
            console.error('Error playing HLS video:', error);
          }
        }
      },
      pause: () => {
        if (videoRef.current) {
          programmaticActionRef.current = true;
          videoRef.current.pause();
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
          programmaticActionRef.current = true;
          videoRef.current.currentTime = time;
        }
      },
      isPaused: () => {
        return videoRef.current?.paused ?? true;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
      getVideoElement: () => {
        return videoRef.current;
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
      console.log('🎬 HLS video started playing', { programmatic: programmaticActionRef.current, isHost });
      // Only emit if this is a user action (not programmatic) and user is host
      if (!programmaticActionRef.current && isHost) {
        onPlay?.();
      }
      programmaticActionRef.current = false;
    };

    const handlePause = () => {
      console.log('⏸️ HLS video paused', { programmatic: programmaticActionRef.current, isHost });
      // Only emit if this is a user action (not programmatic) and user is host
      if (!programmaticActionRef.current && isHost) {
        onPause?.();
      }
      programmaticActionRef.current = false;
    };

    const handleSeeked = () => {
      console.log('🎯 HLS video seeked to:', videoRef.current?.currentTime, {
        programmatic: programmaticActionRef.current,
        isHost,
      });
      // Only emit if this is a user action (not programmatic) and user is host
      if (!programmaticActionRef.current && isHost) {
        onSeeked?.();
      }
      programmaticActionRef.current = false;
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
        controls={isHost}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        preload="metadata"
        controlsList={isHost ? undefined : 'nodownload noremoteplayback'}
        disablePictureInPicture={!isHost}
      />
    );
  }
);

HLSPlayer.displayName = 'HLSPlayer';

export { HLSPlayer };
