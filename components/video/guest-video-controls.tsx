'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Volume2, VolumeX } from 'lucide-react';

interface GuestVideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement> | null;
  className?: string;
}

export function GuestVideoControls({ videoRef, className }: GuestVideoControlsProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Don't render if no video ref
  if (!videoRef) {
    return null;
  }

  const handleFullscreen = () => {
    if (videoRef?.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) {
        (videoRef.current as any).webkitRequestFullscreen();
      } else if ((videoRef.current as any).msRequestFullscreen) {
        (videoRef.current as any).msRequestFullscreen();
      }
    }
  };

  const handleMuteToggle = () => {
    if (videoRef?.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div
      className={`absolute inset-0 ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Controls overlay */}
      <div
        className={`absolute bottom-4 right-4 flex space-x-2 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={handleMuteToggle}
          className="h-8 w-8 bg-black/70 p-0 text-white hover:bg-black/90"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleFullscreen}
          className="h-8 w-8 bg-black/70 p-0 text-white hover:bg-black/90"
          title="Fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
