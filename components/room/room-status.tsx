'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Video } from 'lucide-react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardContent className="flex flex-col items-center space-y-4 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={onRetry}>Try Again</Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface LoadingDisplayProps {
  roomId: string;
}

export function LoadingDisplay({ roomId }: LoadingDisplayProps) {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardContent className="flex flex-col items-center space-y-4 p-6 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <h2 className="text-xl font-semibold">Joining Room</h2>
          <p className="text-muted-foreground">Connecting to room {roomId}...</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface SyncErrorProps {
  error: string;
}

export function SyncError({ error }: SyncErrorProps) {
  return (
    <Card className="border-destructive">
      <CardContent>
        <div className="flex items-center space-x-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface GuestInfoBannerProps {
  onLearnMore: () => void;
  onDismiss: () => void;
}

export function GuestInfoBanner({ onLearnMore, onDismiss }: GuestInfoBannerProps) {
  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
            <Video className="h-4 w-4" />
            <span className="text-sm font-medium">
              You&apos;re watching as a guest - only hosts can control playback
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLearnMore}
              className="text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Learn More
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              ✕
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
