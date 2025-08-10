'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Mic, MicOff, Phone } from 'lucide-react';
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

interface ChatInputProps {
  inputMessage: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  voice?: VoiceConfig;
  mode?: 'sidebar' | 'overlay';
}

export function ChatInput({ inputMessage, onInputChange, onSubmit, voice, mode = 'sidebar' }: ChatInputProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Voice button handlers
  const handleVoiceButtonMouseDown = () => {
    if (!voice?.isEnabled) return;
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      voice.onDisable();
      toast.success('Left voice chat');
    }, 600);
  };

  const handleVoiceButtonMouseUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const handleVoiceButtonClick = () => {
    if (!voice) return;
    if (longPressTriggeredRef.current) return; // ignore click right after long-press
    if (voice.isEnabled) {
      voice.onToggleMute();
    } else if (voice.overCap) {
      toast.error('Voice chat is full (max 5 participants).');
    } else {
      voice.onEnable();
    }
  };

  const handleVoiceButtonContextMenu = (e: React.MouseEvent) => {
    if (!voice?.isEnabled) return;
    e.preventDefault();
    voice.onDisable();
  };

  const inputSize = mode === 'overlay' ? 'h-8' : '';
  const buttonSize = mode === 'overlay' ? 'h-8 w-8' : '';
  const iconSize = mode === 'overlay' ? 'h-3 w-3' : 'h-4 w-4';
  const spacing = mode === 'overlay' ? 'gap-2' : 'space-x-2';

  return (
    <div className={`border-t ${mode === 'overlay' ? 'border-border p-3' : 'p-4'}`}>
      <form onSubmit={onSubmit} className={`flex ${spacing}`}>
        <Input
          placeholder="Type a message..."
          value={inputMessage}
          onChange={onInputChange}
          className={`flex-1 ${inputSize} ${mode === 'overlay' ? 'text-sm' : ''}`}
          maxLength={500}
        />
        {voice && (
          <Button
            type="button"
            size={mode === 'overlay' ? 'sm' : 'icon'}
            variant={voice.isEnabled ? (voice.isMuted ? 'secondary' : 'outline') : 'outline'}
            onMouseDown={handleVoiceButtonMouseDown}
            onMouseUp={handleVoiceButtonMouseUp}
            onMouseLeave={handleVoiceButtonMouseUp}
            onTouchStart={handleVoiceButtonMouseDown}
            onTouchEnd={handleVoiceButtonMouseUp}
            onTouchCancel={handleVoiceButtonMouseUp}
            onClick={handleVoiceButtonClick}
            onContextMenu={handleVoiceButtonContextMenu}
            disabled={voice.isConnecting}
            className={buttonSize ? `${buttonSize} p-0` : ''}
            title={
              voice.isEnabled
                ? voice.isMuted
                  ? 'Unmute (long-press/right-click to leave)'
                  : 'Mute (long-press/right-click to leave)'
                : 'Join Voice'
            }
            aria-label={voice.isEnabled ? (voice.isMuted ? 'Unmute' : 'Mute') : 'Join Voice'}
          >
            {voice.isEnabled ? (
              voice.isMuted ? (
                <MicOff className={iconSize} />
              ) : (
                <Mic className={iconSize} />
              )
            ) : (
              <Phone className={iconSize} />
            )}
          </Button>
        )}
        <Button
          type="submit"
          size={mode === 'overlay' ? 'sm' : 'icon'}
          disabled={!inputMessage.trim()}
          className={buttonSize ? `${buttonSize} p-0` : ''}
        >
          <Send className={iconSize} />
        </Button>
      </form>
    </div>
  );
}
