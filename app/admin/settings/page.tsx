'use client';

import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { ADMIN_ROLES, type AdminRole } from '@/lib/data';
import { useAdmin } from '@/lib/store';
import { btnPrimary, c, card, display, input } from '@/lib/theme';

export default function SettingsPage() {
  const { session, admins, adminsProvisioned, addAdmin, renameAdmin, setAdminRole, removeAdmin, flash } = useAdmin();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('Admin');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState('');

  // The API is the check that counts — this only decides what to render, so a
  // non-Owner sees the list read-only instead of buttons that would 403.
  const isOwner = session?.role === 'Owner';
  const owners = admins.filter(a => a.role === 'Owner').length;

  // Renames are committed on blur rather than per keystroke; holding them in
  // local state keeps the input from fighting the value coming back from the
  // server after a refresh.
  const [draft, setDraft] = useState<Record<string, string>>({});

  const submit = async () => {
    if (email.indexOf('@') < 1) { flash('Enter a valid email address.'); return; }
    setBusy(true);
    await addAdmin(name, email.trim(), role);
    setBusy(false);
    setName('');
    setEmail('');
    setRole('Admin');
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Access control and Privy configuration" />

      <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start', maxWidth: 1100 }}>
        <section style={card}>
          <h2 style={{ margin: '0 0 4px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Admin allowlist</h2>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: c.muted, fontWeight: 300 }}>
            Stored in Supabase. Changes take effect on the next request — no redeploy.
          </p>

          {!adminsProvisioned ? (
            <p style={{ margin: 0, fontSize: 15, color: c.muted, lineHeight: 1.6, fontWeight: 300 }}>
              The <code>admins</code> table does not exist yet. Run <code>sql/admins.sql</code> in the Supabase
              SQL editor to create it and seed the first Owner.
            </p>
          ) : (
            <>
              {admins.map(a => {
                const isMe = a.email === session?.email;
                // Refusing here mirrors the API: the last Owner cannot be
                // demoted or removed, or the console becomes unadministrable.
                const lastOwner = a.role === 'Owner' && owners <= 1;
                return (
                  <div key={a.email} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', alignItems: 'center', gap: 10, padding: '14px 0', borderTop: '0.5px solid ' + c.line, fontSize: 15 }}>
                    {isOwner ? (
                      <input
                        value={draft[a.email] ?? a.name}
                        onChange={e => setDraft(d => ({ ...d, [a.email]: e.target.value }))}
                        onBlur={() => {
                          const next = (draft[a.email] ?? a.name).trim();
                          setDraft(d => Object.fromEntries(Object.entries(d).filter(([k]) => k !== a.email)));
                          if (next && next !== a.name) void renameAdmin(a.email, next);
                        }}
                        placeholder="Display name"
                        style={{ ...input, padding: '9px 12px', border: '0.7px solid ' + c.faintBorder, width: '100%' }}
                      />
                    ) : (
                      <span>{a.name}</span>
                    )}

                    <span style={{ color: c.muted, fontSize: 14, overflowWrap: 'anywhere' }}>{a.email}</span>

                    {isOwner && !lastOwner ? (
                      <select
                        value={a.role}
                        onChange={e => void setAdminRole(a.email, e.target.value as AdminRole)}
                        style={{ ...input, padding: '8px 10px', border: '0.7px solid ' + c.faintBorder, fontSize: 13 }}
                      >
                        {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span style={{ background: c.bg, color: c.muted, padding: '5px 14px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>{a.role}</span>
                    )}

                    {isOwner && !isMe && !lastOwner ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmRemove !== a.email) { setConfirmRemove(a.email); return; }
                          setConfirmRemove('');
                          void removeAdmin(a.email);
                        }}
                        onBlur={() => setConfirmRemove('')}
                        style={{ background: 'transparent', border: '0.7px solid ' + (confirmRemove === a.email ? '#B3261E' : c.faintBorder), color: confirmRemove === a.email ? '#B3261E' : c.soft, borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {confirmRemove === a.email ? 'Confirm' : 'Remove'}
                      </button>
                    ) : <span />}
                  </div>
                );
              })}

              {isOwner ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, marginTop: 20 }}>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Display name" style={{ ...input, width: '100%' }} />
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@uniogate.com" style={{ ...input, width: '100%' }} />
                    <select value={role} onChange={e => setRole(e.target.value as AdminRole)} style={{ ...input, padding: '13px 10px', fontSize: 14 }}>
                      {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button type="button" onClick={submit} disabled={busy} style={{ ...btnPrimary, padding: '13px 24px', opacity: busy ? 0.6 : 1 }}>
                      {busy ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                  <p style={{ margin: '14px 0 0', fontSize: 13, color: c.soft, fontWeight: 300, lineHeight: 1.6 }}>
                    Adding someone lets them sign in with Privy immediately. Only an Owner can change this
                    list, and the last Owner cannot be removed or demoted.
                  </p>
                </>
              ) : (
                <p style={{ margin: '18px 0 0', fontSize: 13, color: c.soft, fontWeight: 300 }}>
                  Only an Owner can change this list.
                </p>
              )}
            </>
          )}
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
