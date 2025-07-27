import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/navigation';
import { SocketProvider } from '@/contexts/socket';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: '.noah - watch party hell yeah!',
  description:
    'browser share & video streaming sucks, a custom solution for watching videos together?',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}>
        <ThemeProvider>
          <SocketProvider>
            <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-background to-background">
              <Navigation />
              <main className="container mx-auto px-4 py-6">{children}</main>
            </div>
            <Toaster richColors />
          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
