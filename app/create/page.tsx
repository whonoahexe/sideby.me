'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSocket } from '@/hooks/use-socket';
import { Play, Users } from 'lucide-react';
import { CreateRoomDataSchema } from '@/types';
import { z } from 'zod';

export default function CreateRoomPage() {
  const [hostName, setHostName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { socket, isConnected, isInitialized } = useSocket();
  const router = useRouter();

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Validate with Zod schema
      const validatedData = CreateRoomDataSchema.parse({
        hostName: hostName.trim(),
      });

      if (!socket || !isConnected) {
        setError('Not connected to server. Please try again.');
        return;
      }

      setIsLoading(true);

      // Listen for room creation response
      socket.once('room-created', ({ roomId, hostToken }) => {
        setIsLoading(false);
        // Store creator info so room page knows not to prompt again
        sessionStorage.setItem(
          'room-creator',
          JSON.stringify({
            roomId,
            hostName: validatedData.hostName,
            hostToken, // Store the unique host token
            timestamp: Date.now(),
          })
        );
        // Navigate immediately - the room page will handle the room-created event
        router.push(`/room/${roomId}`);
      });

      socket.once('room-error', ({ error }) => {
        setIsLoading(false);
        setError(error);
      });

      // Create the room
      socket.emit('create-room', validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.issues[0].message);
      } else {
        setError('Invalid input. Please check your name.');
      }
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Room</CardTitle>
          <CardDescription>
            Start a new room and invite friends to watch videos together
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hostName">Your Name</Label>
              <Input
                id="hostName"
                placeholder="Enter your name"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                disabled={isLoading}
                maxLength={50}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button type="submit" className="w-full" disabled={isLoading || !isConnected}>
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    Creating Room...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Create Room
                  </>
                )}
              </Button>

              {!isConnected && isInitialized && (
                <div className="text-center text-sm text-muted-foreground">
                  Connecting to server...
                </div>
              )}

              {!isInitialized && (
                <div className="text-center text-sm text-muted-foreground">Initializing...</div>
              )}
            </div>
          </form>

          <div className="mt-6 border-t border-border pt-6">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">As the host, you&apos;ll be able to:</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-center space-x-2">
                  <Play className="h-3 w-3" />
                  <span>Control video playback</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Users className="h-3 w-3" />
                  <span>Manage room settings</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
