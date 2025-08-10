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
      <Avatar className={`${avatarSize} flex-shrink-0`}>
        <AvatarFallback className="text-xs">{getInitials(message.userName)}</AvatarFallback>
      </Avatar>

      <div className={`min-w-0 flex-1 space-y-1 ${isOwnMessage ? 'text-right' : ''}`}>
        <div className={`flex items-center ${isOwnMessage && 'flex-row-reverse gap-2'} space-x-2`}>
          <span className={`${textSize} font-medium`}>{!isOwnMessage ? message.userName : 'you!'}</span>
          <span className="text-xs text-muted-foreground">{formatMessageTime(message.timestamp)}</span>
        </div>

        <div
          className={`inline-block max-w-full break-words rounded-lg px-3 py-2 ${textSize} ${
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {message.message}
        </div>
      </div>
    </div>
  );
}
