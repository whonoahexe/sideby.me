'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Copy, Share2, Check } from 'lucide-react';

interface RoomHeaderProps {
  roomId: string;
  hostName: string;
  hostCount: number;
  isHost: boolean;
  showCopied: boolean;
  onCopyRoomId: () => void;
  onShareRoom: () => void;
}

export function RoomHeader({
  roomId,
  hostName,
  hostCount,
  isHost,
  showCopied,
  onCopyRoomId,
  onShareRoom,
}: RoomHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Users className="h-5 w-5 flex-shrink-0" />
              <span className="break-all sm:break-normal">Room {roomId}</span>
              {isHost && <Badge variant="default">Host</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Created by {hostName} • {hostCount} host{hostCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={onCopyRoomId} className="relative overflow-hidden">
              {showCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {showCopied ? 'Copied!' : 'Copy ID'}
            </Button>
            <Button variant="outline" size="sm" onClick={onShareRoom}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
