'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface VoiceControlsProps {
  isEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  participantCount: number;
  roomUserCount: number;
  softCap: number;
  showOverCapDialog: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onToggleMute: () => void;
  onCloseOverCapDialog: () => void;
}

export function VoiceControls({
  isEnabled,
  isMuted,
  isConnecting,
  participantCount,
  roomUserCount,
  softCap,
  showOverCapDialog,
  onEnable,
  onDisable,
  onToggleMute,
  onCloseOverCapDialog,
}: VoiceControlsProps) {
  const atOrOverCap = useMemo(() => roomUserCount > softCap, [roomUserCount, softCap]);

  return (
    <div className="flex items-center gap-2">
      {!isEnabled ? (
        <Button size="sm" variant="default" onClick={onEnable} disabled={isConnecting || atOrOverCap}>
          <Phone className="mr-2 h-4 w-4" />
          {isConnecting ? 'Connecting...' : 'Join Voice'}
        </Button>
      ) : (
        <>
          <Button size="sm" variant={isMuted ? 'secondary' : 'outline'} onClick={onToggleMute}>
            {isMuted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button size="sm" variant="destructive" onClick={onDisable}>
            <PhoneOff className="mr-2 h-4 w-4" /> Leave
          </Button>
          <div className="ml-2 flex items-center text-sm text-muted-foreground">
            <Users className="mr-1 h-4 w-4" /> {participantCount}/{softCap}
          </div>
        </>
      )}

      <Dialog open={showOverCapDialog} onOpenChange={onCloseOverCapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Chat Unavailable</DialogTitle>
            <DialogDescription>
              This room has more than {softCap} participants. Voice chat is limited to {softCap} people for stability.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
