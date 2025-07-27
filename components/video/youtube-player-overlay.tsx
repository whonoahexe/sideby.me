'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface YouTubePlayerOverlayProps {
  onShowChatOverlay?: () => void;
}

export function YouTubePlayerOverlay({ onShowChatOverlay }: YouTubePlayerOverlayProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Handle fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      // Show controls when fullscreen state changes
      setShowControls(true);

      // Auto-hide controls after a delay in fullscreen
      if (isCurrentlyFullscreen) {
        const timeout = setTimeout(() => {
          setShowControls(false);
        }, 3000);

        return () => clearTimeout(timeout);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    // Check initial fullscreen state
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Show controls on mouse movement in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    let hideTimeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimeout);
    };
  }, [isFullscreen]);

  // Only show overlay in fullscreen mode
  if (!isFullscreen || !onShowChatOverlay) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Chat button - positioned in top right */}
      <div className="absolute right-4 top-4">
        <Button
          variant="secondary"
          size="default"
          onClick={onShowChatOverlay}
          className="pointer-events-auto h-11 w-11 border border-white/20 bg-black/60 p-0 text-white transition-all duration-200 hover:border-primary/50 hover:bg-primary hover:text-primary-foreground"
          title="Show chat"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
