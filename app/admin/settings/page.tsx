'use client';

import { useState } from 'react';
import MailboxSettings from '@/components/MailboxSettings';
import PageHeader from '@/components/PageHeader';
import { Btn, Field, Notice, Section, Tag, field, fieldSm, micro } from '@/components/ui';
import { ADMIN_ROLES, type AdminRole } from '@/lib/data';
import { useAdmin } from '@/lib/store';
import { c } from '@/lib/theme';

export default function SettingsPage() {
  const {
    session, admins, adminsProvisioned,
    addAdmin, renameAdmin, setAdminRole, suspendAdmin, removeAdmin, flash
  } = useAdmin();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('Admin');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState('');

  // The API is the check that counts — this only decides what to render, so a
  // non-Owner sees the list read-only instead of buttons that would 403.
  const isOwner = session?.role === 'Owner';
  // Suspended Owners do not count, matching lib/admins.ts: an Owner who cannot
  // sign in is no use for administering the console.
  const owners = admins.filter(a => a.role === 'Owner' && !a.suspendedAt).length;

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
      <PageHeader title="Settings" subtitle="Access control, mailboxes and Privy configuration" />

      <div className="section-stack">
        <Section
          n="01"
          title="Admin allowlist"
          note={
            'Stored in Supabase. Changes take effect on the next request — no redeploy. Adding someone ' +
            'lets them sign in with Privy immediately; suspending keeps their row and their name in the ' +
            'activity log but stops the sign-in; removing also suspends and detaches any mailbox that was theirs.'
          }
        >
          {!adminsProvisioned ? (
            <Notice>
              The <code>admins</code> table does not exist yet. Run <code>sql/admins.sql</code> in the Supabase
              SQL editor to create it and seed the first Owner.
            </Notice>
          ) : (
            <>
              <div className="allowlist-row col-head" style={{ padding: '12px 0 10px', borderBottom: '0.5px solid ' + c.faintBorder }}>
                <span style={micro}>Name</span>
                <span style={micro}>Email</span>
                <span style={micro}>Role</span>
                <span style={{ ...micro, textAlign: 'right' }}>Actions</span>
              </div>

              {admins.map(a => {
                const isMe = a.email === session?.email;
                const suspended = !!a.suspendedAt;
                // Refusing here mirrors the API: the last Owner cannot be
                // demoted, suspended or removed, or the console becomes
                // unadministrable.
                const lastOwner = a.role === 'Owner' && !suspended && owners <= 1;
                return (
                  <div
                    key={a.email}
                    className="allowlist-row"
                    style={{ padding: '16px 0', borderBottom: '0.5px solid ' + c.line, fontSize: 15, opacity: suspended ? 0.55 : 1 }}
                  >
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
                        aria-label={'Display name for ' + a.email}
                        style={{ ...field, padding: '9px 11px', border: '0.7px solid ' + c.faintBorder }}
                      />
                    ) : (
                      <span style={{ fontWeight: 500 }}>{a.name}</span>
                    )}

                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: c.muted, fontSize: 14, overflowWrap: 'anywhere' }}>
                      {a.email}
                      {isMe ? <Tag tone="quiet">You</Tag> : null}
                      {suspended ? <Tag>Suspended</Tag> : null}
                    </span>

                    {isOwner && !lastOwner ? (
                      <select
                        value={a.role}
                        onChange={e => void setAdminRole(a.email, e.target.value as AdminRole)}
                        aria-label={'Role for ' + a.email}
                        style={fieldSm}
                      >
                        {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span><Tag tone={a.role === 'Owner' ? 'tint' : 'neutral'}>{a.role}</Tag></span>
                    )}

                    {/* Both actions share the last cell so the row stays four
                        columns wide — the mobile rule folds it by position. */}
                    {isOwner && !isMe && !lastOwner ? (
                      <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Btn kind="ghost" onClick={() => void suspendAdmin(a.email, !suspended)} style={{ padding: '8px 14px', fontSize: 13 }}>
                          {suspended ? 'Restore' : 'Suspend'}
                        </Btn>
                        <Btn
                          kind={confirmRemove === a.email ? 'dangerSolid' : 'danger'}
                          onClick={() => {
                            if (confirmRemove !== a.email) { setConfirmRemove(a.email); return; }
                            setConfirmRemove('');
                            void removeAdmin(a.email);
                          }}
                          onBlur={() => setConfirmRemove('')}
                          style={{ padding: '8px 14px', fontSize: 13 }}
                        >
                          {confirmRemove === a.email ? 'Confirm' : 'Remove'}
                        </Btn>
                      </span>
                    ) : (
                      // Says why the buttons are missing rather than leaving a
                      // hole where everyone else's are.
                      <span style={{ ...micro, textAlign: 'right' }}>{lastOwner ? 'Last owner' : ''}</span>
                    )}
                  </div>
                );
              })}

              {isOwner ? (
                <div style={{ marginTop: 26, background: c.bg, padding: '22px 22px 24px', borderRadius: 10, border: '0.7px solid ' + c.faintBorder }}>
                  <div style={{ ...micro, color: c.blue, marginBottom: 16 }}>Add an admin</div>
                  <div className="newadmin-row">
                    <Field label="Display name">
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={field} />
                    </Field>
                    <Field label="Email">
                      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@uniogate.com" style={field} />
                    </Field>
                    <Field label="Role">
                      <select value={role} onChange={e => setRole(e.target.value as AdminRole)} style={{ ...field, padding: '11px 10px', fontSize: 14 }}>
                        {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </Field>
                    <Btn kind="primary" onClick={submit} disabled={busy} style={{ padding: '11px 26px', opacity: busy ? 0.6 : 1 }}>
                      {busy ? 'Adding…' : 'Add admin'}
                    </Btn>
                  </div>
                  <p style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.65, fontWeight: 300, color: c.soft }}>
                    Only an Owner can change this list, and the last Owner cannot be removed, demoted or suspended.
                  </p>
                </div>
              ) : (
                <p style={{ margin: '18px 0 0', fontSize: 13, fontWeight: 300, color: c.soft }}>
                  Only an Owner can change this list.
                </p>
              )}
            </>
          )}
        </Section>

        <MailboxSettings />

        <div className="settings-two">
          <Section n="03" title="Privy configuration" note="Read from your Privy dashboard.">
            <div style={{ background: c.ink, color: c.white, padding: '24px 26px 26px', borderRadius: 10, marginTop: 20 }}>
              {[
                ['App ID', process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? 'not set'],
                ['Login methods', 'Email OTP'],
                ['Session length', '12 hours'],
                ['Embedded wallets', 'Off']
              ].map(([k, v], i) => (
                <div
                  key={k}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderTop: i === 0 ? 0 : '1px solid ' + c.sidebarBorder, fontSize: 15 }}
                >
                  <span style={{ ...micro, color: c.sidebarMuted }}>{k}</span>
                  <span style={{ overflowWrap: 'anywhere', textAlign: 'right', fontWeight: 300 }}>{v}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section n="04" title="Hardening" note="What this page does not do for you.">
            <div style={{ padding: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                ['Verify server-side', 'Check the Privy access token in middleware and match the DID against the allowlist before any admin route renders.'],
                ['Trust the API, not the UI', 'Every control here is also enforced in the route handlers — this page only decides what to draw.'],
                ['Keep the last Owner', 'Demotion, suspension and removal of the final active Owner are refused in both places.']
              ].map(([k, v], i) => (
                <div
                  key={k}
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 16, paddingTop: i === 0 ? 0 : 18, borderTop: i === 0 ? 0 : '1px solid ' + c.line }}
                >
                  <span style={{ ...micro, color: c.blue, fontWeight: 600 }}>{'0' + (i + 1)}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{k}</span>
                    <span style={{ display: 'block', marginTop: 5, fontSize: 14, lineHeight: 1.65, fontWeight: 300, color: c.muted }}>{v}</span>
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
