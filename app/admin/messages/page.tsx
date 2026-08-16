'use client';

import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { MESSAGES } from '@/lib/data';
import { useAdmin } from '@/lib/store';
import { btnPrimary, btnSecondary, c, card, display, input } from '@/lib/theme';

export default function MessagesPage() {
  const { note, flash } = useAdmin();
  const [openId, setOpenId] = useState(MESSAGES[0].id);
  const [resolved, setResolved] = useState<Record<number, boolean>>({});
  const [reply, setReply] = useState('');

  const open = MESSAGES.find(m => m.id === openId) ?? MESSAGES[0];
  const unread = MESSAGES.filter(m => m.unread && !resolved[m.id]).length;
  const done = !!resolved[open.id];

  return (
    <>
      <PageHeader title="Messages" subtitle={unread + ' unread of ' + MESSAGES.length + ' enquiries'} />

      <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ background: c.white, borderRadius: 10, overflow: 'hidden' }}>
          {MESSAGES.map(m => {
            const isUnread = m.unread && !resolved[m.id];
            const on = m.id === openId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpenId(m.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: on ? '#F4F6FA' : c.white, border: 0, borderTop: '0.5px solid ' + c.line, borderLeft: '3px solid ' + (on ? c.blue : isUnread ? c.bar : 'transparent'), padding: '18px 20px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: isUnread ? 600 : 400 }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{m.when}</span>
                </div>
                <div style={{ fontSize: 14, color: c.blue, marginTop: 5 }}>{m.subject}</div>
                <div style={{ fontSize: 13, color: c.soft, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 300 }}>
                  {m.body.replace(/\n+/g, ' ').slice(0, 60)}…
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ ...card, padding: 32, display: 'flex', flexDirection: 'column', gap: 22, minHeight: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', borderBottom: '0.5px solid ' + c.line, paddingBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 500 }}>{open.subject}</h2>
              <div style={{ fontSize: 15, color: c.muted, marginTop: 6 }}>{open.name} · {open.email} · {open.when}</div>
            </div>
            <span style={{ background: done ? c.blueTint : c.bg, color: done ? c.blue : c.muted, padding: '6px 16px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>
              {done ? 'Resolved' : open.topic}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, fontWeight: 300, maxWidth: '66ch', whiteSpace: 'pre-line' }}>{open.body}</p>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label htmlFor="reply" style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Reply</label>
            <textarea
              id="reply"
              rows={4}
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write a reply — it sends from hello@uniogate.com"
              style={{ ...input, width: '100%', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  // TODO: POST /api/messages/{id}/reply
                  if (!reply.trim()) { flash('Write a reply first.'); return; }
                  note('Replied to ' + open.email, 'Inbox');
                  flash('Reply sent.');
                  setReply('');
                }}
                style={btnPrimary}
              >
                Send reply
              </button>
              <button
                type="button"
                onClick={() => {
                  setResolved(r => ({ ...r, [open.id]: true }));
                  note('Marked “' + open.subject + '” resolved', 'Inbox');
                  flash('Enquiry marked resolved.');
                }}
                style={btnSecondary}
              >
                Mark resolved
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
