'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { MESSAGE_STATUSES, MESSAGE_STATUS_LABELS, isSettled, type Message, type MessageStatus } from '@/lib/data';
import { relative, subjectOf } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { btnSecondary, c, card, display } from '@/lib/theme';

function labelFor(status: string): string {
  return MESSAGE_STATUS_LABELS[status as MessageStatus] ?? status;
}

export default function MessageInbox({ messages, canDelete }: { messages: Message[]; canDelete: boolean }) {
  const { flash } = useAdmin();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(messages[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const open = messages.find(m => m.id === openId) ?? messages[0] ?? null;
  const unread = messages.filter(m => m.status === 'new').length;

  async function setStatus(id: string, status: MessageStatus) {
    setBusy(true);
    const res = await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      flash(error ?? 'Could not update the enquiry.');
      return;
    }
    flash('Enquiry set to ' + MESSAGE_STATUS_LABELS[status].toLowerCase() + '.');
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch('/api/messages', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setBusy(false);
    setConfirmDelete(false);
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      flash(error ?? 'Could not delete the enquiry.');
      return;
    }
    setOpenId(null);
    flash('Enquiry deleted.');
    router.refresh();
  }

  if (!open) {
    return (
      <>
        <PageHeader title="Messages" subtitle="No enquiries yet" />
        <div className="page-pad">
          <div style={{ ...card, padding: 28, fontSize: 15, color: c.muted, fontWeight: 300 }}>
            Nothing has come through the contact form yet.
          </div>
        </div>
      </>
    );
  }

  const done = isSettled(open.status);

  return (
    <>
      <PageHeader title="Messages" subtitle={unread + ' unread of ' + messages.length + ' enquiries'} />

      <div className="page-pad two-pane">
        <div style={{ background: c.white, borderRadius: 10, overflow: 'hidden' }}>
          {messages.map((m, i) => {
            const isUnread = m.status === 'new';
            const settled = isSettled(m.status);
            const on = m.id === open.id;
            // fetchMessages() sinks settled enquiries, so this fires exactly
            // once, at the boundary between the two groups.
            const startsSettled = settled && !isSettled(messages[i - 1]?.status ?? 'new');
            return (
              <div key={m.id}>
                {startsSettled ? (
                  <div style={{ padding: '14px 20px 8px', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.soft, borderTop: '0.5px solid ' + c.line, background: c.bg }}>
                    Dealt with
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => { setOpenId(m.id); setConfirmDelete(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: on ? '#F4F6FA' : c.white, border: 0, borderTop: '0.5px solid ' + c.line, borderLeft: '3px solid ' + (on ? c.blue : isUnread ? c.bar : 'transparent'), padding: '18px 20px', cursor: 'pointer', opacity: settled && !on ? 0.6 : 1 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15, fontWeight: isUnread ? 600 : 400 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{relative(m.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: c.blue, marginTop: 5 }}>{subjectOf(m.topic, m.message)}</div>
                  <div style={{ fontSize: 13, color: c.soft, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 300 }}>
                    {m.message.replace(/\n+/g, ' ').slice(0, 60)}…
                  </div>
                  {settled ? (
                    <div style={{ fontSize: 12, color: c.soft, marginTop: 6 }}>{labelFor(m.status)}</div>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ ...card, padding: 32, display: 'flex', flexDirection: 'column', gap: 22, minHeight: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', borderBottom: '0.5px solid ' + c.line, paddingBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 500 }}>{subjectOf(open.topic, open.message)}</h2>
              <div style={{ fontSize: 15, color: c.muted, marginTop: 6 }}>
                {open.name} · {open.email} · {relative(open.createdAt)}
              </div>
              {open.business || open.volume ? (
                <div style={{ fontSize: 14, color: c.soft, marginTop: 4 }}>
                  {[open.business, open.volume].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>
            <span style={{ background: done ? c.blueTint : c.bg, color: done ? c.blue : c.muted, padding: '6px 16px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>
              {labelFor(open.status)}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, fontWeight: 300, maxWidth: '66ch', whiteSpace: 'pre-line' }}>{open.message}</p>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: c.soft, lineHeight: 1.6, fontWeight: 300 }}>
              Replying from the console needs a transactional email provider, which is not wired up yet.
              Reply to <a href={'mailto:' + open.email} style={{ color: c.blue }}>{open.email}</a> directly for now.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {MESSAGE_STATUSES.map(s => {
                const on = open.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={busy || on}
                    onClick={() => void setStatus(open.id, s)}
                    style={{
                      ...btnSecondary,
                      padding: '10px 18px',
                      fontSize: 14,
                      background: on ? c.ink : c.white,
                      color: on ? c.white : c.ink,
                      borderColor: on ? c.ink : c.border,
                      cursor: on ? 'default' : 'pointer',
                      opacity: busy && !on ? 0.6 : 1
                    }}
                  >
                    {MESSAGE_STATUS_LABELS[s]}
                  </button>
                );
              })}

              {canDelete ? (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {confirmDelete ? (
                    <>
                      <span style={{ fontSize: 13, color: c.muted }}>Delete permanently?</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(open.id)}
                        style={{ ...btnSecondary, padding: '10px 18px', fontSize: 14, background: '#B3261E', color: c.white, borderColor: '#B3261E', opacity: busy ? 0.6 : 1 }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDelete(false)}
                        style={{ ...btnSecondary, padding: '10px 18px', fontSize: 14 }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDelete(true)}
                      style={{ ...btnSecondary, padding: '10px 18px', fontSize: 14, color: '#B3261E', opacity: busy ? 0.6 : 1 }}
                    >
                      Delete
                    </button>
                  )}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
