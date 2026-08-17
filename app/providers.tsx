'use client';

import { PrivyProvider } from '@privy-io/react-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''}
      config={{
        // The login screen is our own (app/login/page.tsx drives the headless
        // hooks), so Privy's modal never opens and `appearance` is moot. These
        // methods still have to be enabled here and in the Privy dashboard.
        // Email only: an admin is a person with a work address, and a wallet
        // says nothing about who is holding it.
        loginMethods: ['email'],
        // v3 made this per-chain. Admins sign in to read a dashboard; there is
        // nothing to hold, so no wallet is provisioned for them.
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' }
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
