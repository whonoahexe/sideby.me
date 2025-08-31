'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChatMessage } from '@/types';
import { MarkdownMessage } from './markdown-message';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { EmojiPicker, EmojiPickerSearch, EmojiPickerContent, EmojiPickerFooter } from '@/components/ui/emoji-picker';
import { SmilePlus, Reply } from 'lucide-react';
import { useFullscreenPortalContainer } from '@/hooks/use-fullscreen-portal-container';

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  mode?: 'sidebar' | 'overlay';
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string, userName: string, message: string) => void;
  onQuoteClick?: (messageId: string) => void;
}

export function ChatMessageItem({
  message,
  currentUserId,
  mode = 'sidebar',
  onToggleReaction,
  onReply,
  onQuoteClick,
}: ChatMessageItemProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const portalContainer = useFullscreenPortalContainer();

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const formatMessageTime = (timestamp: Date) =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));

  const truncateMessage = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const isOwnMessage = message.userId === currentUserId;
  const avatarSize = mode === 'overlay' ? 'h-6 w-6' : 'h-8 w-8';
  const textSize = mode === 'overlay' ? 'text-sm' : 'text-sm';
  const userHasReacted = (emoji: string) => message.reactions?.[emoji]?.includes(currentUserId);

  return (
    <div className={`flex min-w-0 flex-col space-y-1 ${isOwnMessage ? 'items-end' : ''}`}>
      <div className={`flex w-full space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        {!isOwnMessage && (
          <Avatar className={`${avatarSize} flex-shrink-0`}>
            <AvatarFallback className="font-mono text-primary-800">{getInitials(message.userName)}</AvatarFallback>
          </Avatar>
        )}
        {/* Message Info */}
        <div className={`min-w-0 flex-1 space-y-1 ${isOwnMessage ? 'text-right' : ''}`}>
          <div className={`flex items-center ${isOwnMessage && 'flex-row-reverse gap-2'} space-x-2`}>
            <span className={`${textSize} font-bold tracking-tight`}>{!isOwnMessage ? message.userName : 'you!'}</span>
            <span className="font-mono text-xs tracking-tighter text-neutral">
              {formatMessageTime(message.timestamp)}
            </span>
          </div>

          {/* Reply quote */}
          {message.replyTo && (
            <div
              className={`mb-2 cursor-pointer rounded-md border-l-2 border-muted-foreground bg-muted p-2 text-xs ${isOwnMessage ? 'text-right' : ''}`}
              onClick={() => onQuoteClick?.(message.replyTo!.messageId)}
              title="Click to jump to original message"
            >
              <div className={`flex items-center gap-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                <Reply className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">{message.replyTo.userName}</span>
              </div>
              <div className="mt-1 text-muted-foreground">{truncateMessage(message.replyTo.message)}</div>
            </div>
          )}

          <div
            className={`group relative inline-block max-w-full break-words rounded-md px-3 py-2 tracking-tight text-primary-foreground ${textSize} ${
              isOwnMessage ? 'bg-primary' : 'bg-muted'
            }`}
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {/* Message content */}
            <MarkdownMessage content={message.message} />

            {/* Action buttons (Reply & Reaction picker) */}
            <div className={`absolute -top-3 ${isOwnMessage ? 'right-2' : 'left-2'} flex gap-1`}>
              {/* Reply button */}
              {onReply && (
                <button
                  type="button"
                  aria-label="Reply to message"
                  title="Reply to message"
                  className="pointer-events-none z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/80 text-[11px] text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground group-hover:pointer-events-auto group-hover:opacity-100"
                  onClick={() => onReply(message.id, message.userName, message.message)}
                  onMouseDown={e => e.preventDefault()}
                >
                  <Reply className="h-3 w-3" />
                </button>
              )}

              {/* Reaction picker */}
              {onToggleReaction && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Add reaction"
                      title="Add reaction"
                      className="pointer-events-none z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/80 text-[11px] text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground group-hover:pointer-events-auto group-hover:opacity-100"
                      onMouseDown={e => e.preventDefault()}
                    >
                      <SmilePlus className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align={isOwnMessage ? 'end' : 'start'}
                    side="top"
                    className="w-full max-w-[280px] p-0"
                    sideOffset={6}
                    container={portalContainer}
                  >
                    <div
                      className="h-[320px] w-full"
                      onClick={e => {
                        const target = e.target as HTMLElement;
                        if (target?.dataset?.slot === 'emoji-picker-emoji') {
                          const emojiChar = target.textContent?.trim();
                          if (emojiChar) {
                            onToggleReaction(message.id, emojiChar);
                            setPickerOpen(false); // close after selection
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
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Reactions */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className={`flex flex-wrap gap-1 ${isOwnMessage ? 'justify-end' : 'justify-start'} pl-10 pr-2`}>
          {Object.entries(message.reactions)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([emoji, users]) => {
              const reacted = userHasReacted(emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => onToggleReaction?.(message.id, emoji)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted ${
                    reacted ? 'border-primary bg-primary/20' : 'border-muted'
                  }`}
                  aria-pressed={reacted}
                >
                  <span>{emoji}</span>
                  <span className="font-mono text-[10px]">{users.length}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
