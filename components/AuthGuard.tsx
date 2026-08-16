'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { isAllowed } from '@/lib/allowlist';
import { useAdmin } from '@/lib/store';
import { c } from '@/lib/theme';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { admins } = useAdmin();
  const router = useRouter();

  const email = user?.email?.address ?? user?.google?.email ?? '';
  const allowed = isAllowed(email, admins);
  const unconfigured = admins.length === 0;

  useEffect(() => {
    if (ready && !authenticated) router.replace('/login');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return <div style={{ padding: 40, color: c.muted }}>Checking your session…</div>;
  }

  if (!allowed) {
    return (
      <div style={{ padding: 60, maxWidth: 520 }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 32, fontWeight: 500, margin: 0 }}>
          Not on the allowlist
        </h1>
        <p style={{ fontSize: 16, color: c.muted, lineHeight: 1.6 }}>
          {unconfigured
            ? 'No admin allowlist is configured, so nobody can open the console. Set NEXT_PUBLIC_ADMIN_ALLOWLIST and ADMIN_ALLOWLIST, then restart the dev server.'
            : (email || 'This account') + ' can authenticate with Privy but is not on the admin allowlist. Ask the Owner to add it.'}
        </p>
        <button type="button" onClick={logout} style={{ background: c.blue, color: c.white, border: 0, padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
