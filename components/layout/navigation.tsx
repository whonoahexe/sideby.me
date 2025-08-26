'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Home, Menu, BadgePlus } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();

  const navigationItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/create', label: 'Create Room', icon: BadgePlus },
    { href: '/join', label: 'Join Room', icon: Users },
  ];

  const activeItem = navigationItems.find(item => item.href === pathname);
  const ActiveIcon = activeItem?.icon;

  return (
    <nav className="mx-4 rounded-full border border-border bg-accent">
      <div className="mx-auto p-6">
        <div className="flex h-12 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 px-4 md:px-24">
            <Image src="/logo-monoline.svg" alt="Sideby.me logo" width={32} height={32} className="h-8 w-8" />
            <span className="hidden text-3xl font-semibold tracking-tighter md:flex">sideby.me</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-4 px-24 md:flex">
            {navigationItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button variant={pathname === href ? 'default' : 'ghost'} size="default" className="flex items-center">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Button>
              </Link>
            ))}
          </div>

          {/* Mobile Navigation */}
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="ghost" size="default" className="flex items-center">
              {ActiveIcon && <ActiveIcon className="h-4 w-4" />}
              <span>{activeItem?.label || 'Page'}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Menu className="h-6 w-6" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navigationItems.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} asChild>
                    <Link href={href} className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
