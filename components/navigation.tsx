'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Users, Home } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex w-full items-center justify-between space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <Play className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Watch.With</span>
            </Link>

            <div className="hidden items-center space-x-6 md:flex">
              <Link href="/">
                <Button
                  variant={pathname === '/' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Button>
              </Link>

              <Link href="/create">
                <Button
                  variant={pathname === '/create' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Create Room</span>
                </Button>
              </Link>

              <Link href="/join">
                <Button
                  variant={pathname === '/join' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Join Room</span>
                </Button>
              </Link>
            </div>
          </div>

          <div className="md:hidden">
            <Button variant="ghost" size="sm">
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
