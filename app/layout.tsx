import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/layout/navigation';
import { SocketProvider } from '@/contexts/socket-provider';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/contexts/theme-provider';

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
  // Core Metadata
  title: {
    default: 'sideby.me - built by hermits, for recovering hermits',
    template: '%s - sideby.me',
  },
  description:
    'The ridiculously simple way to host watch parties. Create a room, share a link, and watch anything with friends in perfect sync. No sign-ups, no nonsense.',
  applicationName: 'sideby.me',
  // SEO
  keywords: ['watch party', 'watch together', 'video sync', 'no signup', 'sideby.me', 'realtime'],
  // Author & Brand
  authors: [{ name: 'whonoahexe', url: 'https://github.com/whonoahexe' }],
  creator: 'Noah',
  publisher: 'sideby.me',
  metadataBase: new URL('https://sideby.me'),
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  colorScheme: 'dark light',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'manifest', url: '/site.webmanifest' }],
  },
  // Open Graph Metadata
  openGraph: {
    title: 'sideby.me',
    description:
      'The ridiculously simple way to host watch parties. Create a room, share a link, and watch anything with friends in perfect sync.',
    url: new URL('https://sideby.me'),
    siteName: 'sideby.me',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'sideby.me logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'sideby.me',
    description:
      'The ridiculously simple way to host watch parties. Create a room, share a link, and watch anything with friends in perfect sync.',
    images: ['/android-chrome-512x512.png'],
    site: '@whonoah_exe',
    creator: '@whonoah_exe',
  },
  // Robots & Crawlers
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}>
        <ThemeProvider>
          <SocketProvider>
            {/* Legacy gradient effect */}
            {/* <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-background to-background"> */}
            <div className="min-h-screen bg-background">
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
