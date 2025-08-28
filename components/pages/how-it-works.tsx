'use client';

import { Icon } from '@/components/ui/icon';
import { Pencil, Plus, PartyPopper } from 'lucide-react';

export default function HowItWorks() {
  return (
    <section className="flex w-full shrink-0 grow basis-0 items-center justify-center gap-4 px-6 py-24">
      <div className="flex max-w-7xl shrink-0 grow basis-0 flex-wrap items-center justify-between gap-12">
        <div className="flex min-w-60 max-w-sm flex-1 items-center gap-4">
          <Icon variant="secondary" size="xl" className="shrink-0">
            <Pencil />
          </Icon>
          <span className="font-bold tracking-tight">{'Create a new room or join an existing one.'}</span>
        </div>
        <div className="flex min-w-60 max-w-sm flex-1 items-center gap-4">
          <Icon variant="secondary" size="xl" className="shrink-0">
            <Plus />
          </Icon>
          <span className="font-bold tracking-tight">{'Paste a Youtube or supported URL.'}</span>
        </div>
        <div className="flex min-w-60 max-w-sm flex-1 items-center gap-4">
          <Icon variant="secondary" size="xl" className="shrink-0">
            <PartyPopper />
          </Icon>
          <span className="font-bold tracking-tight">Watch in perfect sync while chatting with your friends.</span>
        </div>
      </div>
    </section>
  );
}
