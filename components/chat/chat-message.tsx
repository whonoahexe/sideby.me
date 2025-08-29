'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChatMessage } from '@/types';

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  mode?: 'sidebar' | 'overlay';
}

export function ChatMessageItem({ message, currentUserId, mode = 'sidebar' }: ChatMessageItemProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  };

  const isOwnMessage = message.userId === currentUserId;
  const avatarSize = mode === 'overlay' ? 'h-6 w-6' : 'h-8 w-8';
  const textSize = mode === 'overlay' ? 'text-sm' : 'text-sm';

  return (
    <div className={`flex min-w-0 space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
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

        {/* Message */}
        <div
          className={`inline-block max-w-full break-words rounded-md px-3 py-2 tracking-tight text-primary-foreground ${textSize} ${
            isOwnMessage ? 'bg-primary' : 'bg-muted'
          }`}
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {message.message}
        </div>
      </div>
    </div>
  );
}
