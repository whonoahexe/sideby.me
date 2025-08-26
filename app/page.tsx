'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Users, Video, MessageCircle, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="mt-16 space-y-6 py-24 text-center">
        <h1 className="mx-auto max-w-5xl text-6xl font-bold tracking-tighter md:text-8xl">OH! HMM, SOMEONE'S HERE?</h1>
        <p className="text-neutral mx-auto max-w-xl text-3xl font-semibold tracking-tighter">
          {`Create rooms, invite friends, and enjoy synchronized video watching with real-time chat!`}
        </p>

        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
          <Link href="/create">
            <Button size="lg">
              <span>Create Room</span>
            </Button>
          </Link>

          <Link href="/join">
            <Button variant="ghost" size="lg">
              <span>Join Room</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-8">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold">Everything you need</h2>
          <p className="text-muted-foreground">{`Simple, fast, and reliable video watching experience (hopefylly)`}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Video className="h-8 w-8 text-primary" />
                <CardTitle>Synchronized Playback</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Perfect synchronization across all devices. Play, pause, and seek together in real-time.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-8 w-8 text-primary" />
                <CardTitle>Real-time Chat</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Chat with your friends while watching. Share reactions and discuss the content live.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Shield className="h-8 w-8 text-primary" />
                <CardTitle>Host Control</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Room hosts have full control over video playback while guests enjoy the experience.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-primary" />
                <CardTitle>Easy Room Creation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create rooms instantly and share the room ID with friends. No sign-up required.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Play className="h-8 w-8 text-primary" />
                <CardTitle>Multiple Video Sources</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Support for YouTube videos and direct video links. Just paste the URL and start watching.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Zap className="h-8 w-8 text-primary" />
                <CardTitle>Instant Connection</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Lightning-fast connections powered by Socket.IO for the best real-time experience.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-8 pb-12">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold">How it works</h2>
          <p className="text-muted-foreground">Get started in just three simple steps</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl font-bold text-primary">1</span>
            </div>
            <h3 className="text-xl font-semibold">Create or Join</h3>
            <p className="text-muted-foreground">Create a new room or join an existing one with a room ID</p>
          </div>

          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl font-bold text-primary">2</span>
            </div>
            <h3 className="text-xl font-semibold">Add Video</h3>
            <p className="text-muted-foreground">
              {`Paste a YouTube or supported video URL (e.g. MP4, M3U8) to start watching together`}
            </p>
          </div>

          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-2xl font-bold text-primary">3</span>
            </div>
            <h3 className="text-xl font-semibold">Enjoy Together</h3>
            <p className="text-muted-foreground">Watch in perfect sync while chatting with your friends</p>
          </div>
        </div>
      </section>
    </div>
  );
}
