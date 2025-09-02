'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateRoom } from '@/hooks/use-create-room';
import { AtSign, PenLine, Play, User, LucideIcon, BadgePlus } from 'lucide-react';
import { Icon } from '../../components/ui/icon';
import HowItWorks from '@/components/pages/how-it-works';
import Link from 'next/link';

const QUIRKY_USERNAMES = [
  'The Friend Who Picked The Movie',
  'Person With The Stable Wi-Fi',
  'Probably Muted',
  'The One With The Link',
  'The Dungeon Master',
  'That Friend From Discord',
  'Not-A-Bot-I-Swear',
] as const;

// Pick a random username on page load
const getRandomUsername = () => QUIRKY_USERNAMES[Math.floor(Math.random() * QUIRKY_USERNAMES.length)];

const HOST_FEATURES = [
  {
    icon: Play,
    title: 'You have the remote',
  },
  {
    icon: PenLine,
    title: 'Skip to the good parts',
  },
  {
    icon: User,
    title: 'Set the rules of the room',
  },
] as const;

function FeatureCard({ icon: IconComponent, title }: { icon: LucideIcon; title: string }) {
  return (
    <Card className="border-neutral-border bg-default-background flex w-full flex-none flex-col items-start gap-4 rounded-md border-solid px-4 py-4 shadow-sm sm:w-40">
      <IconComponent className="text-heading-3 font-heading-3 text-primary" />
      <span className="line-clamp-2 w-full text-sm tracking-tight text-neutral sm:text-base">{title}</span>
    </Card>
  );
}

export default function CreateRoomPage() {
  const { hostName, setHostName, isLoading, error, isConnected, isInitialized, handleCreateRoom } = useCreateRoom();
  // Keep a deterministic placeholder for SSR and update to a random one on the client
  const DEFAULT_PLACEHOLDER = `e.g., ${QUIRKY_USERNAMES[1]}`;
  const [placeholder, setPlaceholder] = useState<string>(DEFAULT_PLACEHOLDER);

  useEffect(() => {
    setPlaceholder(`e.g., ${getRandomUsername()}`);
  }, []);

  return (
    <>
      <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-14 lg:py-14">
        <Card className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-6 rounded-lg border border-border bg-background p-6 sm:gap-8 sm:p-12 lg:gap-12 lg:p-24">
          {/* Header Section */}
          <header className="flex w-full shrink-0 grow basis-0 flex-col items-center justify-center gap-6 sm:gap-8 lg:gap-12">
            <div className="flex w-full shrink-0 grow basis-0 flex-col items-center justify-center gap-4">
              <Icon size="xl" variant="secondary">
                <BadgePlus />
              </Icon>
              <h1 className="whitespace-pre-wrap text-4xl font-bold tracking-tighter sm:text-6xl lg:text-8xl">
                Create Room
              </h1>
            </div>

            {/* Form Section */}
            <div className="flex w-full shrink-0 grow basis-0 flex-col items-center justify-center gap-4">
              <div className="flex w-full flex-col items-start justify-center gap-2 sm:gap-4">
                <h2 className="text-2xl font-extrabold tracking-tighter text-primary sm:text-3xl lg:text-4xl">
                  Player 1
                </h2>
                <p className="text-sm font-bold tracking-tight text-neutral-400 sm:text-base">
                  {`Every good watch party needs a host with a name. That's you.`}
                </p>
              </div>

              <form onSubmit={handleCreateRoom} className="w-full space-y-4">
                {/* Name Input */}
                <div className="w-full space-y-2">
                  <Label htmlFor="hostName" className="text-sm font-bold tracking-tight sm:text-base">
                    Your Callsign
                  </Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-neutral" />
                    <Input
                      id="hostName"
                      name="hostName"
                      type="text"
                      value={hostName}
                      onChange={e => setHostName(e.target.value)}
                      placeholder={placeholder}
                      className="pl-10 text-base tracking-tight sm:text-lg"
                      maxLength={21}
                      required
                      disabled={isLoading || !isConnected}
                      aria-describedby={error ? 'error-message' : undefined}
                    />
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div id="error-message" className="text-sm font-medium text-red-500" role="alert">
                    {error}
                  </div>
                )}

                {/* Connection Status */}
                {!isInitialized && <div className="text-sm font-medium text-yellow-500">Waking up the servers...</div>}
                {isInitialized && !isConnected && (
                  <div className="text-sm font-medium text-red-500">
                    Whoops, looks like you lost connection. Try a quick refresh?
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:gap-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={isLoading || !isConnected || !hostName.trim()}
                  >
                    {isLoading ? 'Creating Room...' : 'Create Room'}
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href="/join">Have a Room Code?</Link>
                  </Button>
                </div>
              </form>
            </div>
          </header>

          {/* Divider */}
          <div className="flex h-px w-full flex-none flex-col items-center bg-border" />

          {/* Features Section */}
          <section className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap lg:flex-nowrap">
            {HOST_FEATURES.map((feature, index) => (
              <FeatureCard key={index} icon={feature.icon} title={feature.title} />
            ))}
          </section>
        </Card>
      </div>

      {/* How it works */}
      <HowItWorks />
    </>
  );
}
