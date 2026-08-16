'use client';

import { PrivyProvider } from '@privy-io/react-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: { theme: 'light', accentColor: '#253E86', logo: '/logo/logo.png' },
        embeddedWallets: { createOnLogin: 'off' }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
