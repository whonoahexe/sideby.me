'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Volume2, VolumeX, Mic, MicOff, X, MinusIcon } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceConfig {
  isEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  participantCount: number;
  overCap: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onToggleMute: () => void;
}

interface ChatHeaderProps {
  mode: 'sidebar' | 'overlay';
  messageCount?: number;
  unreadCount?: number;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  voice?: VoiceConfig;
  onToggleMinimize?: () => void;
  onClose?: () => void;
}

export function ChatHeader({
  mode,
  messageCount = 0,
  unreadCount = 0,
  soundEnabled,
  onSoundToggle,
  voice,
  onToggleMinimize,
  onClose,
}: ChatHeaderProps) {
  const handleSoundToggle = () => {
    onSoundToggle();
    const newState = !soundEnabled;
    toast.success(newState ? 'Notification sounds enabled' : 'Notification sounds disabled', {
      duration: 2000,
      position: 'bottom-right',
    });
  };

  if (mode === 'sidebar') {
    return (
      <div className="rounded-md border border-border p-4">
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-6 w-6" />
          <span className="text-xl font-semibold tracking-tighter">Chat</span>
          <div className="flex w-full items-center justify-between space-x-2 pl-6">
            {voice?.isEnabled && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                {voice.isMuted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}
                {voice.participantCount}
              </Badge>
            )}
            {soundEnabled ? (
              <Volume2 className="h-5 w-5" onClick={handleSoundToggle} />
            ) : (
              <VolumeX className="h-5 w-5" onClick={handleSoundToggle} />
            )}
            <Badge>{messageCount}</Badge>
          </div>
        </div>
      </div>
    );
  }

  // Overlay mode header
  return (
    <div className="flex items-center justify-between border-b border-border p-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Chat</span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {unreadCount}
          </Badge>
        )}
        {voice?.isEnabled && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            {voice.isMuted ? <MicOff className="h-2 w-2" /> : <Mic className="h-2 w-2" />}
            {voice.participantCount}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleSoundToggle} className="h-8 w-8 p-0">
          {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        </Button>
        {onToggleMinimize && (
          <Button variant="ghost" size="sm" onClick={onToggleMinimize} className="h-8 w-8 p-0">
            <MinusIcon className="h-3 w-3" />
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
