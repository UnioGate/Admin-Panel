'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { btnPrimary, c, display } from '@/lib/theme';

export default function LoginPage() {
  const { login, authenticated, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.replace('/admin');
  }, [ready, authenticated, router]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: c.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.9 }}>
        <Image src="/landing-page-images/hero-bg.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>

      <nav style={{ position: 'relative', zIndex: 2, width: '90%', margin: '24px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, padding: '16px 18px', background: '#FFFFFF4D', borderRadius: 40 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo/logo.png" alt="" width={34} height={34} />
          <span style={{ fontFamily: display, fontSize: 26, fontWeight: 600, color: c.blue, letterSpacing: '-0.01em' }}>UnioGate</span>
        </span>
        <span style={{ background: c.ink, color: c.white, padding: '10px 20px', borderRadius: 20, fontSize: 15 }}>Internal console</span>
      </nav>

      <div style={{ position: 'relative', zIndex: 2, width: '90%', maxWidth: 1180, margin: '0 auto', flex: 1, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 60, alignItems: 'center', padding: '64px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 400, padding: '10px 20px', border: '0.7px solid #000', borderRadius: 20 }}>ADMIN ACCESS ONLY</h4>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 64, lineHeight: '110%', fontWeight: 400 }}>
            The room behind<br />the counter.
          </h1>
          <p style={{ margin: 0, fontSize: 20, maxWidth: 520, fontWeight: 300, textWrap: 'pretty' }}>
            Waitlist, merchant enquiries and invites — one console for the people running UnioGate before launch.
          </p>
        </div>

        <div style={{ background: c.white, borderRadius: 10, padding: 40, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 18px 50px rgba(16,24,42,0.10)' }}>
          <h2 style={{ margin: 0, fontFamily: display, fontSize: 30, fontWeight: 500 }}>Sign in</h2>
          <p style={{ margin: 0, fontSize: 16, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
            Authentication runs through Privy. Only emails and wallets on the admin allowlist can open the console.
          </p>
          <button type="button" onClick={login} style={{ ...btnPrimary, padding: '15px 24px', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            Continue with Privy
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#9AA0AE', fontSize: 13 }}>
            <span style={{ flex: 1, height: 0.7, background: c.faintBorder }} />
            <span>allowlisted methods</span>
            <span style={{ flex: 1, height: 0.7, background: c.faintBorder }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ border: '0.7px solid ' + c.border, borderRadius: 10, padding: '13px 16px', fontSize: 15 }}>Email OTP</div>
            <div style={{ border: '0.7px solid ' + c.border, borderRadius: 10, padding: '13px 16px', fontSize: 15 }}>Wallet (EVM)</div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: c.soft, lineHeight: 1.6, fontWeight: 300 }}>
            Sessions expire after 12 hours. Every action here is logged against your Privy DID.
          </p>
        </div>
      </div>
    </div>
  );
}
