'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import type { Message } from '@/lib/data';
import { relative, subjectOf } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { btnSecondary, c, card, display } from '@/lib/theme';

export default function MessageInbox({ messages }: { messages: Message[] }) {
  const { flash } = useAdmin();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(messages[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const open = messages.find(m => m.id === openId) ?? messages[0] ?? null;
  const unread = messages.filter(m => m.status === 'new').length;

  async function setStatus(id: string, status: 'new' | 'handled') {
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
    flash(status === 'handled' ? 'Enquiry marked resolved.' : 'Enquiry reopened.');
    router.refresh();
  }

  if (!open) {
    return (
      <>
        <PageHeader title="Messages" subtitle="No enquiries yet" />
        <div style={{ padding: '32px 40px' }}>
          <div style={{ ...card, padding: 28, fontSize: 15, color: c.muted, fontWeight: 300 }}>
            Nothing has come through the contact form yet.
          </div>
        </div>
      </>
    );
  }

  const done = open.status === 'handled';

  return (
    <>
      <PageHeader title="Messages" subtitle={unread + ' unread of ' + messages.length + ' enquiries'} />

      <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ background: c.white, borderRadius: 10, overflow: 'hidden' }}>
          {messages.map(m => {
            const isUnread = m.status === 'new';
            const on = m.id === open.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpenId(m.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: on ? '#F4F6FA' : c.white, border: 0, borderTop: '0.5px solid ' + c.line, borderLeft: '3px solid ' + (on ? c.blue : isUnread ? c.bar : 'transparent'), padding: '18px 20px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: isUnread ? 600 : 400 }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{relative(m.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, color: c.blue, marginTop: 5 }}>{subjectOf(m.topic, m.message)}</div>
                <div style={{ fontSize: 13, color: c.soft, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 300 }}>
                  {m.message.replace(/\n+/g, ' ').slice(0, 60)}…
                </div>
              </button>
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
              {done ? 'Resolved' : 'New'}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, fontWeight: 300, maxWidth: '66ch', whiteSpace: 'pre-line' }}>{open.message}</p>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: c.soft, lineHeight: 1.6, fontWeight: 300 }}>
              Replying from the console needs a transactional email provider, which is not wired up yet.
              Reply to <a href={'mailto:' + open.email} style={{ color: c.blue }}>{open.email}</a> directly for now.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void setStatus(open.id, done ? 'new' : 'handled')}
                style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}
              >
                {done ? 'Reopen enquiry' : 'Mark resolved'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
