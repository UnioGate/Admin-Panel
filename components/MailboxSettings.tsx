'use client';

import { useState } from 'react';
import { Btn, Field, Notice, Section, Tag, field, fieldSm, micro } from '@/components/ui';
import { useAdmin } from '@/lib/store';
import { c } from '@/lib/theme';

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
    <Section
      n="02"
      title="Mailboxes"
      note={
        <>
          Addresses on the sending domain. Leave one unassigned and every admin can use it — that is
          what <code>support@</code> is. Assign one and it belongs to that person alone.
        </>
      }
    >
      {!mailboxesProvisioned ? (
        <Notice>
          The <code>mailboxes</code> table does not exist yet. Run <code>sql/mailboxes.sql</code> in the
          Supabase SQL editor to create it and seed the three shared addresses.
        </Notice>
      ) : (
        <>
          <div className="mailbox-row col-head" style={{ padding: '12px 0 10px', borderBottom: '0.5px solid ' + c.faintBorder }}>
            <span style={micro}>Address</span>
            <span style={micro}>Assignment</span>
            <span style={{ ...micro, textAlign: 'right' }}>Actions</span>
          </div>

          {mailboxes.length === 0 ? (
            <p style={{ margin: '18px 0 0', fontSize: 15, color: c.muted, fontWeight: 300 }}>No mailboxes yet.</p>
          ) : null}

          {mailboxes.map(m => {
            const suspended = !!m.suspendedAt;
            return (
              <div
                key={m.address}
                className="mailbox-row"
                style={{ padding: '16px 0', borderBottom: '0.5px solid ' + c.line, fontSize: 15, opacity: suspended ? 0.55 : 1 }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', overflowWrap: 'anywhere' }}>
                    <span style={{ fontWeight: 500 }}>{m.address}</span>
                    {suspended ? <Tag>Suspended</Tag> : null}
                    {!m.assignedTo && !suspended ? <Tag tone="quiet">Shared</Tag> : null}
                  </span>
                  {m.label ? (
                    <span style={{ display: 'block', fontSize: 13, color: c.soft, marginTop: 4, fontWeight: 300 }}>{m.label}</span>
                  ) : null}
                </span>

                {isOwner ? (
                  <select
                    value={m.assignedTo ?? ''}
                    onChange={e => void assignMailbox(m.address, e.target.value || null)}
                    aria-label={'Assignment for ' + m.address}
                    style={fieldSm}
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

                {/* Both actions share the last cell so the row stays three
                    columns wide — the mobile rule folds it by position. */}
                {isOwner ? (
                  <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Btn kind="ghost" onClick={() => void suspendMailbox(m.address, !suspended)} style={{ padding: '8px 14px', fontSize: 13 }}>
                      {suspended ? 'Restore' : 'Suspend'}
                    </Btn>
                    <Btn
                      kind={confirmDelete === m.address ? 'dangerSolid' : 'danger'}
                      onClick={() => {
                        if (confirmDelete !== m.address) { setConfirmDelete(m.address); return; }
                        setConfirmDelete('');
                        void removeMailbox(m.address);
                      }}
                      onBlur={() => setConfirmDelete('')}
                      style={{ padding: '8px 14px', fontSize: 13 }}
                    >
                      {confirmDelete === m.address ? 'Confirm' : 'Delete'}
                    </Btn>
                  </span>
                ) : <span />}
              </div>
            );
          })}

          {isOwner ? (
            <div style={{ marginTop: 26, background: c.bg, padding: '22px 22px 24px', borderRadius: 10, border: '0.7px solid ' + c.faintBorder }}>
              <div style={{ ...micro, color: c.blue, marginBottom: 16 }}>Create a mailbox</div>
              <div className="newmailbox-row">
                <Field label="Local part">
                  <input
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    placeholder={'chidile — becomes chidile@' + DOMAIN_HINT}
                    style={field}
                  />
                </Field>
                <Field label="Label (optional)">
                  <input value={label} onChange={e => setLabel(e.target.value)} placeholder="What it is for" style={field} />
                </Field>
                <Field label="Assignment">
                  <select value={owner} onChange={e => setOwner(e.target.value)} style={{ ...field, padding: '11px 10px', fontSize: 14 }}>
                    <option value="">Shared</option>
                    {assignable.map(a => <option key={a.email} value={a.email}>{a.name || a.email}</option>)}
                  </select>
                </Field>
                <Btn kind="primary" onClick={submit} disabled={busy || !local.trim()} style={{ padding: '11px 26px', opacity: busy || !local.trim() ? 0.6 : 1 }}>
                  {busy ? 'Creating…' : 'Create'}
                </Btn>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.65, fontWeight: 300, color: c.soft }}>
                Resend sends as any address on the verified domain, so a new mailbox works
                immediately — no DNS change. Suspending stops it sending but keeps receiving and
                keeps its history; deleting removes the address, and its old conversations stay in
                the console.
              </p>
            </div>
          ) : (
            <p style={{ margin: '18px 0 0', fontSize: 13, color: c.soft, fontWeight: 300 }}>
              Only an Owner can create, assign, suspend or delete mailboxes.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
