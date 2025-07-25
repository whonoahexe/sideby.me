'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { parseVideoUrl } from '@/lib/video-utils';
import { Video, Youtube, FileVideo, ExternalLink } from 'lucide-react';

interface VideoSetupProps {
  onVideoSet: (url: string) => void;
  isHost: boolean;
  hasVideo: boolean;
  videoUrl?: string;
}

export function VideoSetup({ onVideoSet, isHost, hasVideo, videoUrl }: VideoSetupProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError('Please enter a video URL');
      return;
    }

    const parsed = parseVideoUrl(url.trim());
    if (!parsed) {
      setError('Please enter a valid YouTube or MP4 video URL');
      return;
    }

    onVideoSet(url.trim());
    setUrl('');
    setError('');
    setIsDialogOpen(false);
  };

  const getVideoType = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'YouTube';
    }
    return 'Video File';
  };

  const getVideoIcon = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return <Youtube className="h-4 w-4 text-red-500" />;
    }
    return <FileVideo className="h-4 w-4 text-blue-500" />;
  };

  if (hasVideo && videoUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Video className="h-5 w-5" />
            <span>Current Video</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 rounded-lg bg-muted p-3">
              {getVideoIcon(videoUrl)}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{getVideoType(videoUrl)}</div>
                <div className="truncate text-xs text-muted-foreground">{videoUrl}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.open(videoUrl, '_blank')}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            {isHost && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Change Video
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Video</DialogTitle>
                    <DialogDescription>
                      Enter a new YouTube or MP4 video URL to change what everyone is watching.
                    </DialogDescription>
                  </DialogHeader>
                  <VideoUrlForm url={url} setUrl={setUrl} error={error} onSubmit={handleSubmit} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isHost) {
    return (
      <Card>
        <CardHeader className="text-center">
          <Video className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <CardTitle>Waiting for Video</CardTitle>
          <CardDescription>
            The host will set up a video for everyone to watch together.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Video className="h-5 w-5" />
          <span>Set Up Video</span>
        </CardTitle>
        <CardDescription>Add a YouTube or MP4 video URL to start watching together</CardDescription>
      </CardHeader>
      <CardContent>
        <VideoUrlForm url={url} setUrl={setUrl} error={error} onSubmit={handleSubmit} />

        <div className="mt-6 space-y-3">
          <div className="text-sm font-medium">Supported formats:</div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Youtube className="h-4 w-4 text-red-500" />
              <span>YouTube videos (youtube.com, youtu.be)</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileVideo className="h-4 w-4 text-blue-500" />
              <span>Direct video files (MP4, WebM, OGG)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VideoUrlForm({
  url,
  setUrl,
  error,
  onSubmit,
}: {
  url: string;
  setUrl: (url: string) => void;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Video URL</Label>
        <Input
          id="videoUrl"
          placeholder="https://www.youtube.com/watch?v=... or https://example.com/video.mp4"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Button type="submit" className="w-full">
        Set Video
      </Button>
    </form>
  );
}
