'use client';

import { useState } from 'react';
import { useAdmin } from '@/lib/store';
import { btnPrimary, c, card, display, input } from '@/lib/theme';

// The domain an address gets when only a name is typed. Cosmetic — the server
// appends the real one from EMAIL_DOMAIN and refuses anything else, so a stale
// value here shows a wrong placeholder rather than creating a wrong mailbox.
const DOMAIN_HINT = 'uniogate.com';

export default function MailboxSettings() {
  const {
    session, admins, mailboxes, mailboxesProvisioned,
    addMailbox, assignMailbox, suspendMailbox, removeMailbox
  } = useAdmin();

  const [local, setLocal] = useState('');
  const [label, setLabel] = useState('');
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  // The API is the check that counts — this only decides what to render, so a
  // non-Owner sees their own addresses read-only instead of buttons that 403.
  const isOwner = session?.role === 'Owner';
  // A suspended admin cannot open the console, so handing them a mailbox would
  // create one nobody but an Owner could read.
  const assignable = admins.filter(a => !a.suspendedAt);

  const submit = async () => {
    if (!local.trim()) return;
    setBusy(true);
    await addMailbox(local.trim(), label, owner || null);
    setBusy(false);
    setLocal('');
    setLabel('');
    setOwner('');
  };

  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 4px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Mailboxes</h2>
      <p style={{ margin: '0 0 16px', fontSize: 15, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
        Addresses on the sending domain. Leave one unassigned and every admin can use it — that is
        what <code>support@</code> is. Assign one and it belongs to that person alone.
      </p>

      {!mailboxesProvisioned ? (
        <p style={{ margin: 0, fontSize: 15, color: c.muted, lineHeight: 1.6, fontWeight: 300 }}>
          The <code>mailboxes</code> table does not exist yet. Run <code>sql/mailboxes.sql</code> in the
          Supabase SQL editor to create it and seed the three shared addresses.
        </p>
      ) : (
        <>
          {mailboxes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 15, color: c.muted, fontWeight: 300 }}>No mailboxes yet.</p>
          ) : null}

          {mailboxes.map(m => {
            const suspended = !!m.suspendedAt;
            return (
              <div
                key={m.address}
                className="admin-row"
                style={{ padding: '14px 0', borderTop: '0.5px solid ' + c.line, fontSize: 15, opacity: suspended ? 0.6 : 1 }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>
                  {m.address}
                  {suspended ? (
                    <span style={{ marginLeft: 8, fontSize: 12, background: c.bg, color: c.soft, padding: '3px 9px', borderRadius: 20 }}>
                      Suspended
                    </span>
                  ) : null}
                  {m.label ? (
                    <span style={{ display: 'block', fontSize: 13, color: c.soft, marginTop: 2 }}>{m.label}</span>
                  ) : null}
                </span>

                {isOwner ? (
                  <select
                    value={m.assignedTo ?? ''}
                    onChange={e => void assignMailbox(m.address, e.target.value || null)}
                    style={{ ...input, padding: '9px 10px', border: '0.7px solid ' + c.faintBorder, fontSize: 13, width: '100%' }}
                  >
                    <option value="">Shared — every admin</option>
                    {assignable.map(a => (
                      <option key={a.email} value={a.email}>{a.name || a.email}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ color: c.muted, fontSize: 14, overflowWrap: 'anywhere' }}>
                    {m.assignedTo ?? 'Shared'}
                  </span>
                )}

                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => void suspendMailbox(m.address, !suspended)}
                    style={{ background: 'transparent', border: '0.7px solid ' + c.faintBorder, color: c.soft, borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {suspended ? 'Restore' : 'Suspend'}
                  </button>
                ) : <span />}

                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDelete !== m.address) { setConfirmDelete(m.address); return; }
                      setConfirmDelete('');
                      void removeMailbox(m.address);
                    }}
                    onBlur={() => setConfirmDelete('')}
                    style={{ background: 'transparent', border: '0.7px solid ' + (confirmDelete === m.address ? '#B3261E' : c.faintBorder), color: confirmDelete === m.address ? '#B3261E' : c.soft, borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {confirmDelete === m.address ? 'Confirm' : 'Delete'}
                  </button>
                ) : <span />}
              </div>
            );
          })}

          {isOwner ? (
            <>
              <div className="admin-row" style={{ marginTop: 20 }}>
                <input
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                  placeholder={'chidile — becomes chidile@' + DOMAIN_HINT}
                  style={{ ...input, width: '100%' }}
                />
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Label (optional)"
                  style={{ ...input, width: '100%' }}
                />
                <select value={owner} onChange={e => setOwner(e.target.value)} style={{ ...input, padding: '13px 10px', fontSize: 14 }}>
                  <option value="">Shared</option>
                  {assignable.map(a => <option key={a.email} value={a.email}>{a.name || a.email}</option>)}
                </select>
                <button type="button" onClick={submit} disabled={busy || !local.trim()} style={{ ...btnPrimary, padding: '13px 24px', opacity: busy || !local.trim() ? 0.6 : 1 }}>
                  {busy ? 'Creating…' : 'Create'}
                </button>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: 13, color: c.soft, fontWeight: 300, lineHeight: 1.6 }}>
                Resend sends as any address on the verified domain, so a new mailbox works
                immediately — no DNS change. Suspending stops it sending but keeps receiving and
                keeps its history; deleting removes the address, and its old conversations stay in
                the console.
              </p>
            </>
          ) : (
            <p style={{ margin: '18px 0 0', fontSize: 13, color: c.soft, fontWeight: 300 }}>
              Only an Owner can create, assign, suspend or delete mailboxes.
            </p>
          )}
        </>
      )}
    </section>
  );
}
