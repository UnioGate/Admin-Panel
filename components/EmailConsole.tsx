'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { quoteForReply, replySubject, stripHtml, type EmailMessage, type EmailThread } from '@/lib/email';
import { relative, shortDate } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { btnPrimary, btnSecondary, c, card, display, input, pill } from '@/lib/theme';

type Draft = { from: string; to: string; cc: string; subject: string; text: string };

export default function EmailConsole({
  threads, mailboxes, provisioned, configured, canDelete
}: {
  threads: EmailThread[];
  mailboxes: string[];
  provisioned: boolean;
  configured: boolean;
  canDelete: boolean;
}) {
  const { flash } = useAdmin();
  const router = useRouter();

  const [mailbox, setMailbox] = useState('All');
  const [openId, setOpenId] = useState<string | null>(threads[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reply, setReply] = useState('');
  const [draft, setDraft] = useState<Draft>({ from: mailboxes[0] ?? '', to: '', cc: '', subject: '', text: '' });

  const visible = useMemo(
    () => (mailbox === 'All' ? threads : threads.filter(t => t.mailbox === mailbox)),
    [threads, mailbox]
  );

  const open = visible.find(t => t.id === openId) ?? visible[0] ?? null;
  const unread = threads.reduce((n, t) => n + t.unread, 0);

  async function post(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      flash(error ?? 'Something went wrong.');
      return false;
    }
    return true;
  }

  async function setRead(threadId: string, read: boolean) {
    if (await post('/api/email', 'PATCH', { threadId, read })) {
      flash(read ? 'Marked read.' : 'Marked unread.');
      router.refresh();
    }
  }

  async function removeThread(threadId: string) {
    setConfirmDelete(false);
    if (await post('/api/email', 'DELETE', { threadId })) {
      setOpenId(null);
      flash('Conversation deleted.');
      router.refresh();
    }
  }

  async function sendReply() {
    if (!open) return;
    const last = open.messages[open.messages.length - 1];
    const ok = await post('/api/email/send', 'POST', {
      from: open.mailbox ?? mailboxes[0],
      to: open.correspondents,
      subject: replySubject(open.subject),
      text: reply,
      threadId: open.id,
      inReplyTo: last.direction === 'inbound' ? last.id : null
    });
    if (ok) {
      setReply('');
      flash('Reply sent.');
      router.refresh();
    }
  }

  async function sendNew() {
    const ok = await post('/api/email/send', 'POST', {
      from: draft.from,
      to: draft.to,
      cc: draft.cc,
      subject: draft.subject,
      text: draft.text
    });
    if (ok) {
      setComposing(false);
      setDraft({ from: mailboxes[0] ?? '', to: '', cc: '', subject: '', text: '' });
      flash('Message sent.');
      router.refresh();
    }
  }

  if (!configured || !provisioned) {
    return (
      <>
        <PageHeader title="Email" subtitle="Not set up yet" />
        <div style={{ padding: '32px 40px' }}>
          <div style={{ ...card, maxWidth: 640, fontSize: 15, lineHeight: 1.7, fontWeight: 300, color: c.muted }}>
            <h2 style={{ margin: '0 0 12px', fontFamily: display, fontSize: 22, fontWeight: 500, color: c.ink }}>
              {configured ? 'The emails table does not exist yet' : 'Resend is not configured'}
            </h2>
            {configured ? (
              <p style={{ margin: 0 }}>Run the <code>emails</code> migration from the README, then reload.</p>
            ) : (
              <p style={{ margin: 0 }}>
                Set <code>RESEND_API_KEY</code> and <code>RESEND_WEBHOOK_SECRET</code> in
                <code> .env.local</code> and restart the dev server. The README has the DNS and
                webhook steps that go with them.
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Email"
        subtitle={unread ? unread + ' unread across ' + threads.length + ' conversations' : threads.length + ' conversations'}
      />

      <div style={{ padding: '24px 40px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', ...mailboxes].map(m => (
          <button key={m} type="button" onClick={() => { setMailbox(m); setOpenId(null); }} style={pill(mailbox === m)}>
            {m === 'All' ? 'All mailboxes' : m}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setComposing(true)}
          style={{ ...btnPrimary, marginLeft: 'auto', padding: '11px 22px', fontSize: 15 }}
        >
          New message
        </button>
      </div>

      <div style={{ padding: '20px 40px 40px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ background: c.white, borderRadius: 10, overflow: 'hidden' }}>
          {visible.length === 0 ? (
            <div style={{ padding: 24, fontSize: 15, color: c.muted, fontWeight: 300 }}>
              Nothing here yet.
            </div>
          ) : visible.map(t => {
            const on = open?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setOpenId(t.id); setConfirmDelete(false); setReply(''); if (t.unread) void setRead(t.id, true); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: on ? '#F4F6FA' : c.white, border: 0, borderTop: '0.5px solid ' + c.line, borderLeft: '3px solid ' + (on ? c.blue : t.unread ? c.bar : 'transparent'), padding: '16px 20px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 15, fontWeight: t.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.correspondents[0] ?? 'Unknown sender'}
                  </span>
                  <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{relative(t.lastActivity)}</span>
                </div>
                <div style={{ fontSize: 14, color: c.blue, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  {t.mailbox ? (
                    <span style={{ fontSize: 11, background: c.bg, color: c.muted, padding: '3px 9px', borderRadius: 20 }}>{t.mailbox}</span>
                  ) : null}
                  {t.messages.length > 1 ? (
                    <span style={{ fontSize: 11, color: c.soft }}>{t.messages.length} messages</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {open ? (
          <div style={{ ...card, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 560 }}>
            <div style={{ padding: '24px 28px', borderBottom: '0.5px solid ' + c.line, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontFamily: display, fontSize: 24, fontWeight: 500, overflowWrap: 'anywhere' }}>{open.subject}</h2>
                <div style={{ fontSize: 14, color: c.muted, marginTop: 6, overflowWrap: 'anywhere' }}>
                  {open.correspondents.join(', ') || 'No correspondents'}
                  {open.mailbox ? ' · via ' + open.mailbox : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <button type="button" disabled={busy} onClick={() => void setRead(open.id, false)} style={{ ...btnSecondary, padding: '9px 16px', fontSize: 14 }}>
                  Mark unread
                </button>
                {canDelete ? (
                  confirmDelete ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => void removeThread(open.id)} style={{ ...btnSecondary, padding: '9px 16px', fontSize: 14, background: '#B3261E', color: c.white, borderColor: '#B3261E' }}>
                        Delete for good
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...btnSecondary, padding: '9px 16px', fontSize: 14 }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, padding: '9px 16px', fontSize: 14, color: '#B3261E' }}>
                      Delete
                    </button>
                  )
                ) : null}
              </div>
            </div>

            <div style={{ padding: '8px 28px', display: 'flex', flexDirection: 'column' }}>
              {open.messages.map(m => <MessageBlock key={m.id} message={m} />)}
            </div>

            <div style={{ marginTop: 'auto', padding: '20px 28px 28px', borderTop: '0.5px solid ' + c.line }}>
              <div style={{ fontSize: 13, color: c.soft, marginBottom: 8 }}>
                Replying as {open.mailbox ?? mailboxes[0]} to {open.correspondents.join(', ') || '—'}
              </div>
              <textarea
                rows={5}
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Write a reply…"
                style={{ ...input, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={busy || !reply.trim() || open.correspondents.length === 0}
                  onClick={() => void sendReply()}
                  style={{ ...btnPrimary, padding: '11px 24px', fontSize: 15, opacity: busy || !reply.trim() ? 0.5 : 1 }}
                >
                  {busy ? 'Sending…' : 'Send reply'}
                </button>
                <button
                  type="button"
                  onClick={() => setReply(r => r + quoteForReply(open.messages[open.messages.length - 1]))}
                  style={{ ...btnSecondary, padding: '11px 20px', fontSize: 14 }}
                >
                  Quote last message
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...card, fontSize: 15, color: c.muted, fontWeight: 300 }}>
            Select a conversation, or start a new one.
          </div>
        )}
      </div>

      {composing ? (
        <>
          <div onClick={() => setComposing(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,42,0.4)', zIndex: 44 }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 560, maxWidth: '94vw', background: c.white, zIndex: 45, overflowY: 'auto', padding: 32, boxShadow: '-18px 0 50px rgba(16,24,42,0.22)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 24, fontWeight: 500 }}>New message</h2>
              <button type="button" onClick={() => setComposing(false)} style={{ background: c.bg, border: 0, width: 34, height: 34, borderRadius: '50%', fontSize: 16, cursor: 'pointer' }}>×</button>
            </div>

            <label style={{ fontSize: 13, color: c.soft }}>From</label>
            <select value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} style={{ ...input, width: '100%' }}>
              {mailboxes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <label style={{ fontSize: 13, color: c.soft }}>To (comma separated)</label>
            <input value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} style={{ ...input, width: '100%' }} />

            <label style={{ fontSize: 13, color: c.soft }}>Cc</label>
            <input value={draft.cc} onChange={e => setDraft({ ...draft, cc: e.target.value })} style={{ ...input, width: '100%' }} />

            <label style={{ fontSize: 13, color: c.soft }}>Subject</label>
            <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} style={{ ...input, width: '100%' }} />

            <label style={{ fontSize: 13, color: c.soft }}>Message</label>
            <textarea
              rows={12}
              value={draft.text}
              onChange={e => setDraft({ ...draft, text: e.target.value })}
              style={{ ...input, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />

            <button
              type="button"
              disabled={busy || !draft.to.trim() || !draft.text.trim()}
              onClick={() => void sendNew()}
              style={{ ...btnPrimary, marginTop: 6, opacity: busy || !draft.to.trim() || !draft.text.trim() ? 0.5 : 1 }}
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </aside>
        </>
      ) : null}
    </>
  );
}

function MessageBlock({ message }: { message: EmailMessage }) {
  const outbound = message.direction === 'outbound';
  // Deliberately not rendering the sender's HTML. Inbound mail is untrusted
  // markup from strangers, and injecting it here would run it on the same
  // origin as the admin session. The text part reads fine.
  const body = (message.text ?? '').trim() || stripHtml(message.html ?? '') || '(empty message)';

  return (
    <div style={{ padding: '20px 0', borderBottom: '0.5px solid ' + c.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: outbound ? c.blue : c.ink, overflowWrap: 'anywhere' }}>
          {outbound ? 'You' : message.fromName ?? message.fromAddress}
          <span style={{ fontWeight: 300, color: c.soft }}>
            {outbound ? ' · ' + message.fromAddress + (message.sentBy ? ' (' + message.sentBy + ')' : '') : ' · ' + message.fromAddress}
          </span>
        </span>
        <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{shortDate(message.createdAt)}</span>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '72ch' }}>
        {body}
      </p>

      {message.attachments.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {message.attachments.map(a => (
            <a
              key={a.id}
              href={'/api/email/attachment?email=' + encodeURIComponent(message.resendId ?? '') + '&id=' + encodeURIComponent(a.id)}
              style={{ fontSize: 13, color: c.blue, background: c.bg, padding: '7px 13px', borderRadius: 8, textDecoration: 'none' }}
            >
              {a.filename ?? 'attachment'} · {Math.max(1, Math.round(a.size / 1024))} KB
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
