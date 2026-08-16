'use client';

import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useAdmin } from '@/lib/store';
import { btnPrimary, c, card, display, input } from '@/lib/theme';

export default function SettingsPage() {
  const { admins, addAdmin, renameAdmin, flash } = useAdmin();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const submit = () => {
    if (email.indexOf('@') < 1) { flash('Enter a valid email address.'); return; }
    addAdmin(name, email.trim());
    setName('');
    setEmail('');
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Access control and Privy configuration" />

      <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start', maxWidth: 1100 }}>
        <section style={card}>
          <h2 style={{ margin: '0 0 4px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Admin allowlist</h2>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: c.muted, fontWeight: 300 }}>Privy DIDs matched against these addresses.</p>

          {admins.map((a, i) => (
            <div key={a.email} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '0.5px solid ' + c.line, fontSize: 15 }}>
              <input
                value={a.name}
                onChange={e => renameAdmin(i, e.target.value)}
                placeholder="Display name"
                style={{ ...input, padding: '9px 12px', border: '0.7px solid ' + c.faintBorder, width: '100%' }}
              />
              <span style={{ color: c.muted, fontSize: 14, overflowWrap: 'anywhere' }}>{a.email}</span>
              <span style={{ background: c.bg, color: c.muted, padding: '5px 14px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>{a.role}</span>
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginTop: 20 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Display name" style={{ ...input, width: '100%' }} />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@uniogate.com" style={{ ...input, width: '100%' }} />
            <button type="button" onClick={submit} style={{ ...btnPrimary, padding: '13px 24px' }}>Add</button>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: c.soft, fontWeight: 300 }}>
            Names show across the console instead of raw addresses. Only the Owner can edit this list.
          </p>
        </section>

        <section style={{ ...card, background: c.ink, color: c.white }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Privy configuration</h2>
          <p style={{ margin: '0 0 20px', fontSize: 15, color: '#A9B3CC', fontWeight: 300 }}>Read from your Privy dashboard.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15 }}>
            {[
              ['App ID', process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? 'not set'],
              ['Login methods', 'Email OTP, Wallet'],
              ['Session length', '12 hours'],
              ['Embedded wallets', 'Off']
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: c.sidebarMuted }}>{k}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '22px 0 0', fontSize: 14, color: '#A9B3CC', lineHeight: 1.7, fontWeight: 300 }}>
            Gate the console server-side too: verify the Privy access token in middleware and check the DID against the allowlist before any admin route renders.
          </p>
        </section>
      </div>
    </>
  );
}
