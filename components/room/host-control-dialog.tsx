'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

interface HostControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HostControlDialog({ open, onOpenChange }: HostControlDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Video className="h-5 w-5 text-blue-500" />
            <span>Video Control Information</span>
          </DialogTitle>
          <DialogDescription>
            Learn about video controls and permissions in Watch.with rooms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Guest Permissions</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>• Watch videos in perfect sync with everyone</li>
              <li>• Use chat to communicate with other viewers</li>
              <li>• See who&apos;s currently watching</li>
              <li>• Request host promotion from current hosts</li>
            </ul>
          </div>

          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950">
            <h4 className="font-medium text-green-900 dark:text-green-100">Host Permissions</h4>
            <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-300">
              <li>• Control video playback (play, pause, seek)</li>
              <li>• Set or change the video URL</li>
              <li>• Promote other users to host</li>
              <li>• All guest permissions</li>
            </ul>
          </div>

          <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
            <h4 className="font-medium text-amber-900 dark:text-amber-100">Need Controls?</h4>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Ask any current host to promote you using the crown button (👑) next to your name in
              the user list.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h4>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              These shortcuts work for hosts only:
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
              <div>• Space/K - Play/Pause</div>
              <div>• ←/→ - Seek ±10s</div>
              <div>• J/L - Seek ±10s</div>
              <div>• ↑/↓ - Volume</div>
              <div>• F - Fullscreen</div>
              <div>• M - Mute</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
