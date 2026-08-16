'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAdmin } from '@/lib/store';
import { c } from '@/lib/theme';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  // The verdict is the server's — requireAdmin() has already checked the cookie
  // against the table. This component decides what to render, not who is in.
  const { session, adminsProvisioned } = useAdmin();
  const router = useRouter();

  const email = user?.email?.address ?? user?.google?.email ?? '';

  useEffect(() => {
    if (ready && !authenticated) router.replace('/login');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return <div style={{ padding: 40, color: c.muted }}>Checking your session…</div>;
  }

  if (!session) {
    return (
      <div className="page-pad" style={{ maxWidth: 520 }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 32, fontWeight: 500, margin: 0 }}>
          {adminsProvisioned ? 'Not on the allowlist' : 'Allowlist not set up'}
        </h1>
        <p style={{ fontSize: 16, color: c.muted, lineHeight: 1.6 }}>
          {adminsProvisioned
            ? (email || 'This account') + ' can authenticate with Privy but is not in the admins table. Ask an Owner to add it.'
            : 'The admins table does not exist yet, so nobody can open the console. Run sql/admins.sql in the Supabase SQL editor — it seeds the first Owner.'}
        </p>
        <button type="button" onClick={logout} style={{ background: c.blue, color: c.white, border: 0, padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
