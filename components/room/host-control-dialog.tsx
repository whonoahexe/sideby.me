'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Video, Crown, Users } from 'lucide-react';
import { useEffect } from 'react';

interface HostControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HostControlDialog({ open, onOpenChange }: HostControlDialogProps) {
  useEffect(() => {
    if (open) {
      // Get current scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      // Temporarily add padding to prevent layout shift
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      // Remove padding when modal closes
      document.body.style.paddingRight = '';
    }

    return () => {
      // Cleanup on unmount
      document.body.style.paddingRight = '';
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] max-h-[85vh] w-[95vw] max-w-md translate-x-[-50%] translate-y-[-50%] gap-0 p-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center space-x-2 text-base sm:text-lg">
            <Video className="h-5 w-5 text-blue-500" />
            <span>Video Controls</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Learn about permissions and controls in Sideby.me rooms.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950 sm:p-4">
              <h4 className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100 sm:text-base">
                <Users className="h-4 w-4" />
                Guest Permissions
              </h4>
              <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300 sm:text-sm">
                <li>• Watch videos in perfect sync</li>
                <li>• Chat with other viewers</li>
                <li>• See who&apos;s watching</li>
                <li>• Request host promotion</li>
              </ul>
            </div>

            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950 sm:p-4">
              <h4 className="flex items-center gap-2 text-sm font-medium text-green-900 dark:text-green-100 sm:text-base">
                <Crown className="h-4 w-4" />
                Host Permissions
              </h4>
              <ul className="mt-2 space-y-1 text-xs text-green-700 dark:text-green-300 sm:text-sm">
                <li>• Control video playback</li>
                <li>• Set or change video URL</li>
                <li>• Promote other users to host</li>
                <li>• All guest permissions</li>
              </ul>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950 sm:p-4">
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100 sm:text-base">Need Controls?</h4>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 sm:text-sm">
                Ask any host to promote you using the crown button (👑) next to your name.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end border-t bg-gray-50 p-6 pt-4 dark:bg-black">
          <Button onClick={() => onOpenChange(false)} size="sm">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
