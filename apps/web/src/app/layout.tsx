import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: {
    default: 'Voyahub — Book tickets, tours and experiences worldwide',
    template: '%s | Voyahub',
  },
  description:
    'Skip-the-line tickets, guided tours, river cruises and day trips in over 20 cities across Europe and North America. Instant confirmation and free cancellation on most bookings.',
  keywords: ['tickets', 'tours', 'experiences', 'attractions', 'things to do', 'travel'],
  openGraph: {
    type: 'website',
    siteName: 'Voyahub',
    locale: 'en_US',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}