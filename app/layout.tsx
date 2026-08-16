import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'UnioGate Admin',
  description: 'Internal console for the UnioGate waitlist and contact inbox'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Extensions such as Grammarly add attributes to <body> before React
          hydrates, which reads as a mismatch. This is shallow: it covers this
          element's own attributes, not anything rendered inside it. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
