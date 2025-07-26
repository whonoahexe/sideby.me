'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSocket } from '@/hooks/use-socket';
import { isValidRoomId } from '@/lib/video-utils';
import { Users, Hash } from 'lucide-react';

export default function JoinRoomPage() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { socket, isConnected, isInitialized } = useSocket();
  const router = useRouter();

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (userName.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }

    if (userName.trim().length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    // Check for invalid characters (allow letters, numbers, spaces, basic punctuation)
    if (!/^[a-zA-Z0-9\s\-_.!?]+$/.test(userName.trim())) {
      setError('Name can only contain letters, numbers, spaces, and basic punctuation (- _ . ! ?)');
      return;
    }

    if (!isValidRoomId(roomId.trim().toUpperCase())) {
      setError('Please enter a valid 6-character room ID');
      return;
    }

    if (!socket || !isConnected) {
      setError('Not connected to server. Please try again.');
      return;
    }

    setIsLoading(true);
    setError('');

    // Listen for room join response
    socket.once('room-joined', () => {
      setIsLoading(false);
      // Store the join data for the room page
      sessionStorage.setItem(
        'join-data',
        JSON.stringify({
          roomId: roomId.trim().toUpperCase(),
          userName: userName.trim(),
          timestamp: Date.now(),
        })
      );
      router.push(`/room/${roomId.trim().toUpperCase()}`);
    });

    socket.once('room-error', ({ error }) => {
      setIsLoading(false);
      setError(error);
    });

    // Join the room
    socket.emit('join-room', {
      roomId: roomId.trim().toUpperCase(),
      userName: userName.trim(),
    });
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setRoomId(value);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Room</CardTitle>
          <CardDescription>
            Enter a room ID to join friends and watch videos together
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  id="roomId"
                  placeholder="ABC123"
                  value={roomId}
                  onChange={handleRoomIdChange}
                  disabled={isLoading}
                  className="pl-10 text-center font-mono text-lg tracking-widest"
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                6-character room code (letters and numbers)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                placeholder="Enter your name"
                value={userName}
                onChange={e => setUserName(e.target.value)}
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
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isConnected || !roomId || !userName}
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    Joining Room...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Join Room
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
              <p className="text-sm text-muted-foreground">Don&apos;t have a room ID?</p>
              <Button variant="link" onClick={() => router.push('/create')} className="h-auto p-0">
                Create a new room instead
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
