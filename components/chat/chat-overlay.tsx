'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, MessageCircle, Volume2, VolumeX, X, MinusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ChatMessage, TypingUser } from '@/types';
import { useNotificationSound } from '@/hooks/use-notification-sound';

interface ChatOverlayProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  typingUsers?: TypingUser[];
  isVisible: boolean;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  onMarkMessagesAsRead?: () => void;
}

export function ChatOverlay({
  messages,
  currentUserId,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  typingUsers = [],
  isVisible,
  isMinimized,
  onToggleMinimize,
  onClose,
  onMarkMessagesAsRead,
}: ChatOverlayProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate unread messages (messages not sent by current user and not read)
  const unreadMessages = messages.filter(msg => msg.userId !== currentUserId && !msg.isRead);
  const unreadCount = unreadMessages.length;

  // Handle client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Mark messages as read when chat is visible and not minimized
  useEffect(() => {
    if (isVisible && !isMinimized && unreadCount > 0) {
      onMarkMessagesAsRead?.();
    }
  }, [isVisible, isMinimized, unreadCount, onMarkMessagesAsRead]);

  // Notification sound hook
  const { enabled: soundEnabled, toggleEnabled: toggleSound, playNotification } = useNotificationSound();

  // Handle sound toggle with user feedback
  const handleSoundToggle = () => {
    toggleSound();
    const newState = !soundEnabled;
    toast.success(newState ? 'Notification sounds enabled' : 'Notification sounds disabled', {
      duration: 2000,
      position: 'bottom-right',
    });
  };

  // Auto-scroll to bottom only when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messages.length > previousMessageCount && !isMinimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

      // Play notification sound for new unread messages from other users
      if (previousMessageCount > 0) {
        const newMessages = messages.slice(previousMessageCount);
        const hasNewUnreadMessageFromOther = newMessages.some(msg => msg.userId !== currentUserId && !msg.isRead);

        if (hasNewUnreadMessageFromOther) {
          playNotification();
        }
      }
    }
    setPreviousMessageCount(messages.length);
  }, [messages, previousMessageCount, currentUserId, playNotification, isMinimized]);

  // Scroll to bottom when typing users change
  useEffect(() => {
    if (typingUsers.length > 0 && !isMinimized && scrollAreaRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typingUsers, isMinimized]);

  // Handle typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputMessage(value);

    // Start typing indicator
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onTypingStop?.();
      }
    }, 1000);

    // Stop typing immediately if input is empty
    if (!value.trim() && isTyping) {
      setIsTyping(false);
      onTypingStop?.();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputMessage.trim()) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');

      // Stop typing indicator when message is sent
      if (isTyping) {
        setIsTyping(false);
        onTypingStop?.();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

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

  if (!isVisible || !isClient) {
    return null;
  }

  // Get the fullscreen element - this is key for proper portal rendering
  const fullscreenElement =
    document.fullscreenElement ||
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
    (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ||
    (document as Document & { msFullscreenElement?: Element }).msFullscreenElement;

  const overlayContent = (
    <div
      className={`fixed right-6 top-6 z-[2147483647] border border-border bg-background/95 shadow-lg backdrop-blur-sm ${
        isMinimized ? 'h-12 w-12 rounded-full' : 'h-96 w-80 rounded-lg'
      }`}
    >
      {isMinimized ? (
        /* Minimized State - Just icon with badge */
        <div className="flex h-full w-full items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMinimize}
            className="relative h-8 w-8 p-0 hover:bg-background/50"
          >
            <MessageCircle className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Chat</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleSoundToggle} className="h-8 w-8 p-0">
                {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onToggleMinimize} className="h-8 w-8 p-0">
                <MinusIcon className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}

      {!isMinimized && (
        <>
          {/* Messages */}
          <div ref={scrollAreaRef} className="h-64 flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className="flex gap-2">
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarFallback className="text-xs">{getInitials(message.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground">{message.userName}</span>
                      <span className="text-xs text-muted-foreground">{formatMessageTime(message.timestamp)}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-foreground">{message.message}</p>
                  </div>
                </div>
              ))
            )}

            {/* Typing indicators */}
            {typingUsers.length > 0 && (
              <div className="flex gap-2">
                <div className="h-6 w-6 flex-shrink-0" />
                <div className="text-sm italic text-muted-foreground">
                  {typingUsers.length === 1
                    ? `${typingUsers[0].userName} is typing...`
                    : `${typingUsers.length} people are typing...`}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="h-8 flex-1 text-sm"
                maxLength={500}
              />
              <Button type="submit" size="sm" disabled={!inputMessage.trim()} className="h-8 w-8 p-0">
                <Send className="h-3 w-3" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );

  // Render to fullscreen element if available, otherwise document.body
  const portalTarget = fullscreenElement || document.body;
  return createPortal(overlayContent, portalTarget);
}
