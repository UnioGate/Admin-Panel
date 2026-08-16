'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useLoginWithEmail, useLoginWithSiwe, usePrivy } from '@privy-io/react-auth';
import { btnPrimary, c, display, input as inputStyle, pill } from '@/lib/theme';

// Minimal EIP-1193 surface — enough to request accounts and personal_sign.
type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

function injectedWallet(): Eip1193 | undefined {
  return (globalThis as { ethereum?: Eip1193 }).ethereum;
}

const noopSubscribe = () => () => {};

export default function LoginPage() {
  const { authenticated, ready } = usePrivy();
  const router = useRouter();

  const [method, setMethod] = useState<'email' | 'wallet'>('email');
  // Which half of the email flow to show. Privy's `state` reports progress but
  // never returns to `initial`, so "use a different email" needs its own flag.
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);

  // Read on the client only, so the server render and the first client render
  // agree: no wallet until we know otherwise.
  const hasWallet = useSyncExternalStore(noopSubscribe, () => !!injectedWallet(), () => false);

  const onComplete = useCallback(() => router.replace('/admin'), [router]);
  const onError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err ?? 'Sign-in failed. Try again.'));
  }, []);

  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({ onComplete, onError });
  const { generateSiweMessage, loginWithSiwe, state: siweState } = useLoginWithSiwe({ onComplete, onError });

  useEffect(() => {
    if (ready && authenticated) router.replace('/admin');
  }, [ready, authenticated, router]);

  const awaitingCode = stage === 'code';
  const sending = emailState.status === 'sending-code';
  const verifying = emailState.status === 'submitting-code';
  const signing = walletBusy || siweState.status === 'generating-message'
    || siweState.status === 'awaiting-signature' || siweState.status === 'submitting-signature';

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const address = email.trim().toLowerCase();
    // No allowlist check here any more. This page is public and pre-auth, so
    // checking would mean either shipping the list of admins to the browser or
    // exposing an endpoint that answers "is this person an admin?" — an
    // enumeration oracle either way. Anyone may request a code; only an
    // allowlisted address gets past AuthGuard and requireAdmin() afterwards.
    try {
      await sendCode({ email: address });
      setEmail(address);
      setStage('code');
    } catch (err) {
      onError(err);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await loginWithCode({ code });
    } catch (err) {
      onError(err);
    }
  }

  async function handleWallet() {
    setError(null);
    const provider = injectedWallet();
    if (!provider) {
      setError('No browser wallet detected. Install MetaMask or sign in with email.');
      return;
    }
    setWalletBusy(true);
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error('Wallet returned no account.');
      const message = await generateSiweMessage({ address, chainId: 'eip155:1' });
      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, address]
      })) as string;
      await loginWithSiwe({ signature, message });
    } catch (err) {
      onError(err);
    } finally {
      setWalletBusy(false);
    }
  }

  function restartEmail() {
    setError(null);
    setCode('');
    setEmail('');
    setStage('email');
  }

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

          {!awaitingCode && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setMethod('email'); setError(null); }} style={pill(method === 'email')}>Email code</button>
              <button type="button" onClick={() => { setMethod('wallet'); setError(null); }} style={pill(method === 'wallet')}>Wallet (EVM)</button>
            </div>
          )}

          {method === 'email' && !awaitingCode && (
            <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label htmlFor="admin-email" style={{ fontSize: 13, color: c.soft }}>Work email</label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@uniogate.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              />
              <button type="submit" disabled={sending || !ready} style={{ ...btnPrimary, padding: '15px 24px', fontSize: 16, opacity: sending || !ready ? 0.6 : 1 }}>
                {sending ? 'Sending code…' : 'Send sign-in code'}
              </button>
            </form>
          )}

          {method === 'email' && awaitingCode && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label htmlFor="admin-code" style={{ fontSize: 13, color: c.soft }}>
                Six-digit code sent to {email}
              </label>
              <input
                id="admin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ ...inputStyle, width: '100%', letterSpacing: '0.4em', fontSize: 20 }}
              />
              <button type="submit" disabled={verifying || code.length < 6} style={{ ...btnPrimary, padding: '15px 24px', fontSize: 16, opacity: verifying || code.length < 6 ? 0.6 : 1 }}>
                {verifying ? 'Verifying…' : 'Verify and sign in'}
              </button>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <button type="button" onClick={() => sendCode({ email }).catch(onError)} style={{ background: 'none', border: 0, padding: 0, color: c.blue, cursor: 'pointer', fontSize: 13 }}>
                  Resend code
                </button>
                <button type="button" onClick={restartEmail} style={{ background: 'none', border: 0, padding: 0, color: c.soft, cursor: 'pointer', fontSize: 13 }}>
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {method === 'wallet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: c.soft, lineHeight: 1.6, fontWeight: 300 }}>
                Connects your browser wallet and signs a Sign-In with Ethereum message. Nothing is sent on-chain and no fee is charged.
              </p>
              <button type="button" onClick={handleWallet} disabled={signing || !ready} style={{ ...btnPrimary, padding: '15px 24px', fontSize: 16, opacity: signing || !ready ? 0.6 : 1 }}>
                {signing ? 'Waiting for your wallet…' : 'Connect wallet and sign'}
              </button>
              {!hasWallet && (
                <p style={{ margin: 0, fontSize: 13, color: c.soft, fontWeight: 300 }}>
                  No browser wallet detected in this browser.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 14, color: '#B4232A', lineHeight: 1.6 }}>{error}</p>
          )}

          <p style={{ margin: 0, fontSize: 13, color: c.soft, lineHeight: 1.6, fontWeight: 300 }}>
            Sessions expire after 12 hours. Every action here is logged against your Privy DID.
          </p>
        </div>
      </div>
    </div>
  );
}
