'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';
import { ChatMessage, TypingUser } from '@/types';
import { Chat } from '@/components/chat/chat';

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

interface ChatOverlayProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  typingUsers?: TypingUser[];
  voice?: VoiceConfig;
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
  voice,
  isVisible,
  isMinimized,
  onToggleMinimize,
  onClose,
  onMarkMessagesAsRead,
}: ChatOverlayProps) {
  const [isClient, setIsClient] = useState(false);

  // Calculate unread messages
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
        <Chat
          mode="overlay"
          messages={messages}
          currentUserId={currentUserId}
          onSendMessage={onSendMessage}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          typingUsers={typingUsers}
          voice={voice}
          unreadCount={unreadCount}
          onToggleMinimize={onToggleMinimize}
          onClose={onClose}
        />
      )}
    </div>
  );

  // Render to fullscreen element if available, otherwise document.body
  const portalTarget = fullscreenElement || document.body;
  return createPortal(overlayContent, portalTarget);
}
