'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle } from 'lucide-react';
import { ChatMessage, TypingUser } from '@/types';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import { ChatHeader } from './chat-header';
import { ChatMessageItem } from './chat-message';
import { ChatInput } from './chat-input';
import { TypingIndicator } from './typing-indicator';

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

export interface ChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  typingUsers?: TypingUser[];
  className?: string;
  voice?: VoiceConfig;
  // Mode props
  mode?: 'sidebar' | 'overlay';
  unreadCount?: number;
  onToggleMinimize?: () => void;
  onClose?: () => void;
}

export function Chat({
  messages,
  currentUserId,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  typingUsers = [],
  className,
  voice,
  mode = 'sidebar',
  unreadCount = 0,
  onToggleMinimize,
  onClose,
}: ChatProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notification sound hook
  const { enabled: soundEnabled, toggleEnabled: toggleSound, playNotification } = useNotificationSound();

  // Auto-scroll to bottom only when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messages.length > previousMessageCount) {
      // Scroll within the chat container, not the whole page
      if (scrollAreaRef.current) {
        if (mode === 'sidebar') {
          // For sidebar mode, scroll within the ScrollArea
          const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth',
            });
          }
        } else {
          // For overlay mode, scroll within the chat area
          scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }

      // Play notification sound for new messages from other users
      if (previousMessageCount > 0) {
        const newMessages = messages.slice(previousMessageCount);
        const hasNewMessageFromOther = newMessages.some(msg => msg.userId !== currentUserId);

        if (hasNewMessageFromOther) {
          playNotification();
        }
      }
    }
    setPreviousMessageCount(messages.length);
  }, [messages, previousMessageCount, currentUserId, playNotification, mode]);

  // Scroll to bottom when typing users change
  useEffect(() => {
    if (typingUsers.length > 0) {
      if (scrollAreaRef.current) {
        if (mode === 'sidebar') {
          // Use a more gentle scroll that doesn't affect the main page
          const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth',
            });
          }
        } else {
          // For overlay mode, scroll within the chat area
          scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [typingUsers, mode]);

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

  // Empty state component
  const EmptyState = () => (
    <div className="py-6 text-center text-muted-foreground">
      <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
      <p>{`It's quiet in here... too quiet :/ Start the conversation!`}</p>
    </div>
  );

  // Render sidebar mode
  if (mode === 'sidebar') {
    return (
      <Card className={`ml-6 mr-6 lg:ml-0 ${className}`}>
        {/* Header */}
        <CardHeader className="p-0">
          <CardTitle>
            <ChatHeader
              mode="sidebar"
              messageCount={messages.length}
              soundEnabled={soundEnabled}
              onSoundToggle={toggleSound}
              voice={voice}
            />
          </CardTitle>
        </CardHeader>

        {/* Messages */}
        <CardContent className="p-0">
          <ScrollArea className="h-96 px-4" ref={scrollAreaRef}>
            <div className="min-w-0 space-y-4 pb-4">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                messages.map(message => (
                  <ChatMessageItem key={message.id} message={message} currentUserId={currentUserId} mode="sidebar" />
                ))
              )}

              <TypingIndicator typingUsers={typingUsers} mode="sidebar" />
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <ChatInput
            inputMessage={inputMessage}
            onInputChange={handleInputChange}
            onSubmit={handleSendMessage}
            voice={voice}
            mode="sidebar"
          />
        </CardContent>
      </Card>
    );
  }

  // Render overlay mode
  return (
    <>
      {/* Header */}
      <ChatHeader
        mode="overlay"
        unreadCount={unreadCount}
        soundEnabled={soundEnabled}
        onSoundToggle={toggleSound}
        voice={voice}
        onToggleMinimize={onToggleMinimize}
        onClose={onClose}
      />

      {/* Messages */}
      <div ref={scrollAreaRef} className="h-64 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>{`It's quiet in here... too quiet :/ Start the conversation!`}</p>
          </div>
        ) : (
          messages.map(message => (
            <ChatMessageItem key={message.id} message={message} currentUserId={currentUserId} mode="overlay" />
          ))
        )}

        <TypingIndicator typingUsers={typingUsers} mode="overlay" />
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        inputMessage={inputMessage}
        onInputChange={handleInputChange}
        onSubmit={handleSendMessage}
        voice={voice}
        mode="overlay"
      />
    </>
  );
}
