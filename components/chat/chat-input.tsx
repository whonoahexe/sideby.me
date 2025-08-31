'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Mic, MicOff, Phone, Smile, X, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiPicker, EmojiPickerSearch, EmojiPickerContent, EmojiPickerFooter } from '@/components/ui/emoji-picker';
import { useFullscreenPortalContainer } from '@/hooks/use-fullscreen-portal-container';

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
  onEmojiSelect?: (emoji: string) => void;
  replyTo?: {
    messageId: string;
    userName: string;
    message: string;
  } | null;
  onCancelReply?: () => void;
}

export function ChatInput({
  inputMessage,
  onInputChange,
  onSubmit,
  voice,
  mode = 'sidebar',
  onEmojiSelect,
  replyTo,
  onCancelReply,
}: ChatInputProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ignoreNextCloseRef = useRef(false);
  const caretWasAtEndRef = useRef(true);
  const lastValueRef = useRef(inputMessage);

  const portalContainer = useFullscreenPortalContainer();

  // When the external value changes, if caret was at end, keep scroll at end
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const prev = lastValueRef.current;
    lastValueRef.current = inputMessage;
    if (inputMessage.length >= prev.length && caretWasAtEndRef.current) {
      requestAnimationFrame(() => {
        try {
          el.selectionStart = el.selectionEnd = el.value.length;
          el.scrollLeft = el.scrollWidth;
        } catch {}
      });
    }
  }, [inputMessage]);

  // Voice button handlers
  const handleVoiceButtonMouseDown = () => {
    longPressTriggeredRef.current = false;
    if (!voice?.isEnabled) return; // Only start long-press timer when currently connected
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      // Mark as long-press, perform disconnect, keep flag true so the ensuing click is ignored
      longPressTriggeredRef.current = true;
      voice.onDisable();
      toast.success("Voice chat disconnected. It's quiet again!");
      // After the click event from this press has had a chance to fire
      setTimeout(() => {
        longPressTriggeredRef.current = false;
      }, 250);
    }, 600);
  };

  const handleVoiceButtonMouseUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const handleVoiceButtonClick = () => {
    if (!voice) return;
    if (longPressTriggeredRef.current) return;
    if (voice.isEnabled) {
      voice.onToggleMute();
    } else if (voice.overCap) {
      toast.error("Whoa, it's a full house! The voice channel is at its max of 5 people.");
    } else {
      voice.onEnable();
    }
  };

  const handleVoiceButtonContextMenu = (e: React.MouseEvent) => {
    if (!voice?.isEnabled) return;
    e.preventDefault();
    voice.onDisable();
    toast.success("Voice chat disconnected. It's quiet again!");
    longPressTriggeredRef.current = false;
  };

  const inputSize = mode === 'overlay' ? 'h-8' : '';
  const buttonSize = mode === 'overlay' ? 'h-8 w-8' : '';
  const iconSize = mode === 'overlay' ? 'h-3 w-3' : 'h-4 w-4';
  const spacing = mode === 'overlay' ? 'gap-2' : 'space-x-2';

  const truncateMessage = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className={`relative border-t border-border ${mode === 'overlay' ? 'border-border p-4' : 'mt-1 pt-8'}`}>
      {/* Reply preview */}
      {replyTo && (
        <div
          className="absolute bottom-full left-0 right-0 z-10 mb-1 flex items-center gap-2 rounded-t border border-b-0 border-muted bg-background/95 p-2 text-sm shadow-lg backdrop-blur-sm"
          style={{ marginLeft: mode === 'overlay' ? '1rem' : '0', marginRight: mode === 'overlay' ? '1rem' : '0' }}
        >
          <Reply className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-muted-foreground">{replyTo.userName}</div>
            <div className="truncate text-xs text-muted-foreground">{truncateMessage(replyTo.message)}</div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className={`flex ${spacing}`}>
        <div className="relative flex-1">
          <Input
            placeholder="Don't be shy..."
            value={inputMessage}
            onChange={onInputChange}
            className={`pr-9 ${inputSize} ${mode === 'overlay' ? 'text-sm' : ''}`}
            maxLength={500}
            ref={inputRef}
            onFocus={() => {
              const el = inputRef.current;
              if (!el) return;
              if (caretWasAtEndRef.current) {
                requestAnimationFrame(() => {
                  try {
                    el.selectionStart = el.selectionEnd = el.value.length;
                    el.scrollLeft = el.scrollWidth;
                  } catch {}
                });
              }
            }}
            onSelect={() => {
              const el = inputRef.current;
              if (!el) return;
              caretWasAtEndRef.current = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
            }}
            onKeyUp={() => {
              const el = inputRef.current;
              if (!el) return;
              caretWasAtEndRef.current = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
            }}
            onClick={() => {
              const el = inputRef.current;
              if (!el) return;
              caretWasAtEndRef.current = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
            }}
          />
          <Popover
            open={emojiOpen}
            onOpenChange={next => {
              if (!next && ignoreNextCloseRef.current) {
                // Skip closing triggered by focus shift back to input
                ignoreNextCloseRef.current = false;
                return;
              }
              setEmojiOpen(next);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Add emoji"
                title="Add emoji"
                className={`absolute inset-y-0 right-2 hidden items-center text-muted-foreground hover:text-foreground focus:outline-none md:inline-flex ${mode === 'overlay' ? 'text-[0.65rem]' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                }}
              >
                <Smile className={iconSize} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-full max-w-[270px] p-0" sideOffset={4} container={portalContainer}>
              <div
                className="h-[320px] w-full"
                onClick={e => {
                  const target = e.target as HTMLElement;
                  if (target?.dataset?.slot === 'emoji-picker-emoji') {
                    const emojiChar = target.textContent?.trim();
                    if (emojiChar) {
                      onEmojiSelect?.(emojiChar);
                      // Keep popover open, refocus input but ignore the close it might trigger
                      ignoreNextCloseRef.current = true;
                      requestAnimationFrame(() => {
                        const el = inputRef.current;
                        if (el) {
                          el.focus();
                          try {
                            el.selectionStart = el.selectionEnd = el.value.length;
                            el.scrollLeft = el.scrollWidth;
                          } catch {}
                        }
                      });
                    }
                  }
                }}
              >
                <EmojiPicker className="h-full">
                  <EmojiPickerSearch placeholder="Search" autoFocus />
                  <EmojiPickerContent />
                  <EmojiPickerFooter />
                </EmojiPicker>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Voice button */}
        {voice && (
          <Button
            type="button"
            size={mode === 'overlay' ? 'sm' : 'icon'}
            variant={voice.isEnabled ? (voice.isMuted ? 'destructive' : 'outline') : 'outline'}
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
                  ? 'Go live (hold to leave voice)'
                  : 'Go silent (hold to leave voice)'
                : 'Hop on voice chat'
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

        {/* Send button */}
        <Button
          type="submit"
          variant={inputMessage.trim() ? 'default' : 'secondary'}
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
