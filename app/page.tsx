'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import HowItWorks from '@/components/pages/how-it-works';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="mt-16 space-y-6 py-24 text-center">
        <h1 className="mx-auto max-w-5xl text-6xl font-bold tracking-tighter md:text-8xl">{`OH! HMM, SOMEONE'S HERE?`}</h1>
        <p className="mx-auto max-w-xl text-3xl font-semibold tracking-tighter text-neutral">
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

      {/* Experimental Cards */}
      <section className="flex w-full justify-center rounded-md bg-primary/60 px-6 py-24">
        <div className="flex w-full max-w-7xl flex-wrap items-center justify-center gap-12">
          <div className="flex min-w-80 max-w-xl flex-col items-start justify-center gap-12 self-stretch">
            <div className="flex flex-col items-start gap-4">
              <span className="text-4xl font-extrabold tracking-tighter text-primary-foreground">
                Synchronized Playback from Multiple Video Sources.
              </span>
              <span className="tracking-tight text-primary-foreground">
                {`Perfect synchronization across all devices. Play, pause, and seek together in real-time. Support for YouTube videos and direct video links. Just paste the URL and start watching.`}
              </span>
            </div>
            <Link href="/create">
              <Button size="lg">Create Room</Button>
            </Link>
          </div>
          <div className="flex shrink-0 grow basis-0 flex-col items-center justify-center self-stretch">
            <div className="h-144 flex w-full min-w-60 max-w-xl flex-col items-center justify-center overflow-hidden rounded-md">
              <img
                className="w-full shrink-0 grow basis-0 object-cover"
                alt="Synchronized Playback from Multiple Video Sources"
                src="https://res.cloudinary.com/subframe/image/upload/v1724705524/uploads/302/l5oq75rpdkq2kowa2xkj.png"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex w-full justify-center rounded-md px-6 py-24">
        <div className="flex w-full max-w-7xl flex-row-reverse flex-wrap items-center justify-center gap-12">
          <div className="flex min-w-80 max-w-xl flex-col items-start justify-center gap-12 self-stretch">
            <div className="flex flex-col items-start gap-4">
              <span className="text-4xl font-extrabold tracking-tighter text-primary-foreground">
                Real-time Chat with Host Control.
              </span>
              <span className="tracking-tight text-primary-foreground">
                {`Room hosts have full control over video playback while guests enjoy the experience. Create rooms instantly and share the room ID with friends. No sign-up required.`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/create">
                <Button size="lg">Create Room</Button>
              </Link>
              <Link href="/join">
                <Button variant="ghost" size="lg">
                  Join Room
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex shrink-0 grow basis-0 flex-col items-center justify-center self-stretch">
            <div className="h-144 flex w-full min-w-60 max-w-xl flex-col items-center justify-center overflow-hidden rounded-md">
              <img
                className="w-full shrink-0 grow basis-0 object-cover"
                src="https://res.cloudinary.com/subframe/image/upload/v1724690133/uploads/302/tswlwr0qfwwhkgbjwplw.png"
                alt="Real-time Chat with Host Control"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* CTA */}
      <div className="flex w-full shrink-0 grow basis-0 flex-col items-center justify-center gap-2 px-6 py-24">
        <div className="flex w-full max-w-7xl flex-col items-center justify-center gap-8 rounded-lg bg-primary-900 px-6 pb-16 pt-28">
          <div className="flex w-full flex-col items-center justify-center gap-6 py-12">
            <span className="w-full max-w-3xl whitespace-pre-wrap text-center text-5xl font-extrabold tracking-tighter text-primary-300 md:text-7xl md:font-bold">
              {'OH CMON, GO AHEAD AND TRY IT OUT, HELP A JOBLESS FRIEND :)'}
            </span>
            <span className="w-full max-w-3xl whitespace-pre-wrap text-center font-bold tracking-tighter text-black">
              {
                'Also planning support for listening parties, study rooms, productivity collabs in real-time with extreme low latency (yay?)'
              }
            </span>
          </div>
          <Link href="/create">
            <Button variant="secondary" size="lg">
              Create Room
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
