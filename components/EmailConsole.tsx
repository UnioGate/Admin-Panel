'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import EmailSearch from '@/components/EmailSearch';
import PageHeader from '@/components/PageHeader';
import {
  formatBytes, MAX_TOTAL_ATTACHMENT_BYTES, messageBody, quoteForReply, replySubject, threadInFolder,
  type EmailFolder, type EmailMessage, type EmailThread
} from '@/lib/email';
import { relative, shortDate } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { btnPrimary, btnSecondary, c, card, display, input, pill } from '@/lib/theme';

type Draft = { from: string; to: string; cc: string; subject: string; text: string };

/** Everything a send needs, as a form, because a message may carry files. */
function sendForm(fields: Record<string, string | null | undefined>, files: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
  for (const file of files) form.append('files', file);
  return form;
}

export default function EmailConsole({
  threads, mailboxes, readableMailboxes, mailboxesProvisioned, provisioned, configured, canDelete
}: {
  threads: EmailThread[];
  /** Addresses this admin may send as: theirs and the shared ones, minus any suspended. */
  mailboxes: string[];
  /** Those plus the suspended ones, whose old mail is still worth reading. */
  readableMailboxes: string[];
  mailboxesProvisioned: boolean;
  provisioned: boolean;
  configured: boolean;
  canDelete: boolean;
}) {
  const { flash } = useAdmin();
  const router = useRouter();

  const [mailbox, setMailbox] = useState('All');
  const [folder, setFolder] = useState<EmailFolder>('all');
  const [openId, setOpenId] = useState<string | null>(threads[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Draft>({ from: mailboxes[0] ?? '', to: '', cc: '', subject: '', text: '' });

  // The mailbox filter and the folder filter are independent: "support@, sent"
  // is a reasonable thing to ask for.
  const inMailbox = useMemo(
    () => (mailbox === 'All' ? threads : threads.filter(t => t.mailbox === mailbox)),
    [threads, mailbox]
  );

  const visible = useMemo(
    () => inMailbox.filter(t => threadInFolder(t, folder)),
    [inMailbox, folder]
  );

  // Counted after the mailbox filter, so the tabs describe what you would
  // actually get if you clicked them.
  const counts = useMemo(() => ({
    all: inMailbox.length,
    inbox: inMailbox.filter(t => t.hasInbound).length,
    sent: inMailbox.filter(t => t.hasOutbound).length
  }), [inMailbox]);

  const open = visible.find(t => t.id === openId) ?? visible[0] ?? null;
  const unread = threads.reduce((n, t) => n + t.unread, 0);
  const awaiting = inMailbox.filter(t => t.hasOutbound && t.awaitingReply).length;

  // Reply from the address the conversation came to. If that address is
  // suspended, or is not one of yours, there is no honest `from` to use — the
  // server would refuse anyway, so say why here instead of failing on send.
  const replyFrom = open?.mailbox && mailboxes.includes(open.mailbox) ? open.mailbox : null;
  const canSend = mailboxes.length > 0;

  async function post(url: string, method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    // A form sets its own content-type, boundary and all. Setting it by hand
    // here would produce a body the server cannot split apart.
    const form = body instanceof FormData;
    const res = await fetch(url, {
      method,
      headers: form ? undefined : { 'content-type': 'application/json' },
      body: form ? body : JSON.stringify(body)
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
    if (!open || !replyFrom) return;
    const last = open.messages[open.messages.length - 1];
    const ok = await post('/api/email/send', 'POST', sendForm({
      from: replyFrom,
      to: open.correspondents.join(','),
      subject: replySubject(open.subject),
      text: reply,
      threadId: open.id,
      inReplyTo: last.direction === 'inbound' ? last.id : null
    }, replyFiles));
    if (ok) {
      setReply('');
      setReplyFiles([]);
      flash('Reply sent.');
      router.refresh();
    }
  }

  async function sendNew() {
    const ok = await post('/api/email/send', 'POST', sendForm({
      from: draft.from,
      to: draft.to,
      cc: draft.cc,
      subject: draft.subject,
      text: draft.text
    }, draftFiles));
    if (ok) {
      setComposing(false);
      setDraft({ from: mailboxes[0] ?? '', to: '', cc: '', subject: '', text: '' });
      setDraftFiles([]);
      flash('Message sent.');
      router.refresh();
    }
  }

  /**
   * Opens a conversation from a search result. The filters have to come off
   * first: a hit in a mailbox you have filtered out, or in Sent while you are
   * looking at Inbox, would otherwise select a thread the list cannot show and
   * appear to do nothing.
   */
  function openThread(threadId: string) {
    const found = threads.find(t => t.id === threadId);
    setSearching(false);
    setMailbox('All');
    setFolder('all');
    setConfirmDelete(false);
    setReply('');
    setReplyFiles([]);
    setOpenId(threadId);
    if (found?.unread) void setRead(threadId, true);
  }

  // Cmd-K on a Mac, Ctrl-K everywhere else — what every console with a search
  // box binds it to.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(s => !s);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!configured || !provisioned || !mailboxesProvisioned) {
    return (
      <>
        <PageHeader title="Email" subtitle="Not set up yet" />
        <div className="page-pad">
          <div style={{ ...card, maxWidth: 640, fontSize: 15, lineHeight: 1.7, fontWeight: 300, color: c.muted }}>
            <h2 style={{ margin: '0 0 12px', fontFamily: display, fontSize: 22, fontWeight: 500, color: c.ink }}>
              {!configured
                ? 'Resend is not configured'
                : !provisioned
                  ? 'The emails table does not exist yet'
                  : 'The mailboxes table does not exist yet'}
            </h2>
            {!configured ? (
              <p style={{ margin: 0 }}>
                Set <code>RESEND_API_KEY</code> and <code>RESEND_WEBHOOK_SECRET</code> in
                <code> .env.local</code> and restart the dev server. The README has the DNS and
                webhook steps that go with them.
              </p>
            ) : !provisioned ? (
              <p style={{ margin: 0 }}>Run <code>sql/emails.sql</code> in the Supabase SQL editor, then reload.</p>
            ) : (
              <p style={{ margin: 0 }}>
                Run <code>sql/mailboxes.sql</code> in the Supabase SQL editor, then reload. It holds the
                addresses this console can send and receive as — they used to live
                in <code>EMAIL_MAILBOXES</code>.
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
        subtitle={
          [
            threads.length + ' conversation' + (threads.length === 1 ? '' : 's'),
            unread ? unread + ' unread' : '',
            awaiting ? awaiting + ' awaiting a reply' : ''
          ].filter(Boolean).join(' · ')
        }
      />

      <div className="filter-bar stack-sm">
        {/* Folder first: which half of the conversation you are looking for is
            a bigger question than which address it went through. */}
        <div className="segmented" role="group" aria-label="Folder">
          {([
            ['all', 'All', counts.all],
            ['inbox', 'Inbox', counts.inbox],
            ['sent', 'Sent', counts.sent]
          ] as const).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              aria-pressed={folder === key}
              onClick={() => { setFolder(key); setOpenId(null); }}
              style={{
                flex: 1, background: folder === key ? c.ink : 'transparent',
                color: folder === key ? c.white : c.ink, border: 0, borderRadius: 20,
                padding: '9px 18px', fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {label} <span style={{ opacity: 0.65, fontSize: 13 }}>{n}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSearching(true)}
          style={{ ...btnSecondary, marginLeft: 'auto', padding: '11px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
        >
          <span aria-hidden>⌕</span> Search
          <kbd style={{ fontSize: 11, fontWeight: 400, color: c.soft, background: c.bg, borderRadius: 5, padding: '2px 6px', fontFamily: 'inherit' }}>
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          disabled={!canSend}
          onClick={() => setComposing(true)}
          title={canSend ? undefined : 'You have no mailbox that can send. An Owner assigns one in Settings.'}
          style={{ ...btnPrimary, padding: '11px 22px', fontSize: 15, opacity: canSend ? 1 : 0.5 }}
        >
          New message
        </button>
      </div>

      {/* One mailbox means the pills would be a row of one — not worth the space. */}
      {readableMailboxes.length > 1 ? (
        <div className="filter-bar scroll-x" style={{ flexWrap: 'nowrap', paddingTop: 12 }}>
          {['All', ...readableMailboxes].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMailbox(m); setOpenId(null); }}
              style={{ ...pill(mailbox === m), whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {m === 'All' ? 'All mailboxes' : m}
            </button>
          ))}
        </div>
      ) : null}

      <div className="page-pad-tight two-pane-wide">
        <div style={{ background: c.white, borderRadius: 10, overflow: 'hidden' }}>
          {visible.length === 0 ? (
            <div style={{ padding: 24, fontSize: 15, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
              {folder === 'inbox'
                ? 'Nothing has come in here yet.'
                : folder === 'sent'
                  ? 'You have not sent anything from this mailbox yet.'
                  : 'Nothing here yet.'}
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
                  <span style={{ fontSize: 15, fontWeight: t.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {/* Which way the conversation last moved, before the name.
                        A list of addresses reads the same whether they wrote to
                        you or you wrote to them, and the folder tabs do not help
                        in All. */}
                    <span
                      aria-hidden
                      style={{ color: t.lastDirection === 'inbound' ? c.blue : c.soft, marginRight: 7, fontWeight: 600 }}
                    >
                      {t.lastDirection === 'inbound' ? '↓' : '↑'}
                    </span>
                    <span style={{ color: c.soft, fontWeight: 400 }}>
                      {t.lastDirection === 'inbound' ? 'From ' : 'To '}
                    </span>
                    {t.correspondents[0] ?? 'Unknown sender'}
                  </span>
                  <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{relative(t.lastActivity)}</span>
                </div>
                <div style={{ fontSize: 14, color: c.blue, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  {t.mailbox ? (
                    <span style={{ fontSize: 11, background: c.bg, color: c.muted, padding: '3px 9px', borderRadius: 20 }}>{t.mailbox}</span>
                  ) : null}

                  {/* Otherwise the only way to find out a conversation has a
                      file is to open it. */}
                  {t.attachmentCount > 0 ? (
                    <span
                      title={t.attachmentCount + ' attachment' + (t.attachmentCount === 1 ? '' : 's')}
                      style={{ fontSize: 11, color: c.muted }}
                    >
                      📎 {t.attachmentCount}
                    </span>
                  ) : null}

                  {/* The state of a conversation we started: still waiting, or
                      they came back. Without this, Sent is a list of things you
                      cannot tell apart. */}
                  {t.hasOutbound && t.awaitingReply ? (
                    <span style={{ fontSize: 11, background: c.bg, color: c.soft, padding: '3px 9px', borderRadius: 20 }}>
                      Awaiting reply
                    </span>
                  ) : null}
                  {t.weStarted && t.hasInbound ? (
                    <span style={{ fontSize: 11, background: c.blueTint, color: c.blue, padding: '3px 9px', borderRadius: 20 }}>
                      Replied
                    </span>
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

            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14, background: c.bg }}>
              {open.messages.map(m => <MessageBlock key={m.id} message={m} />)}
            </div>

            <div style={{ marginTop: 'auto', padding: '20px 28px 28px', borderTop: '0.5px solid ' + c.line }}>
              <div style={{ fontSize: 13, color: c.soft, marginBottom: 8 }}>
                {/* No silent substitution. Replying from a different address
                    than the one they wrote to would look like a stranger
                    barging into the conversation. */}
                {replyFrom
                  ? 'Replying as ' + replyFrom + ' to ' + (open.correspondents.join(', ') || '—')
                  : (open.mailbox ?? 'This mailbox') + ' cannot send — it is suspended, or it is not one of yours.'}
              </div>
              <textarea
                rows={5}
                value={reply}
                disabled={!replyFrom}
                onChange={e => setReply(e.target.value)}
                placeholder={replyFrom ? 'Write a reply…' : 'Replies are disabled for this mailbox.'}
                style={{ ...input, width: '100%', resize: 'vertical', fontFamily: 'inherit', opacity: replyFrom ? 1 : 0.6 }}
              />

              <div style={{ marginTop: 10 }}>
                <FilePicker id="reply-files" files={replyFiles} onChange={setReplyFiles} disabled={!replyFrom} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busy || !replyFrom || (!reply.trim() && replyFiles.length === 0) || open.correspondents.length === 0}
                  onClick={() => void sendReply()}
                  style={{ ...btnPrimary, padding: '11px 24px', fontSize: 15, opacity: busy || !replyFrom || (!reply.trim() && replyFiles.length === 0) ? 0.5 : 1 }}
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
          <aside className="drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, background: c.white, zIndex: 45, overflowY: 'auto', padding: 32, boxShadow: '-18px 0 50px rgba(16,24,42,0.22)', display: 'flex', flexDirection: 'column', gap: 14 }}>
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

            <label style={{ fontSize: 13, color: c.soft }}>Attachments</label>
            <FilePicker id="draft-files" files={draftFiles} onChange={setDraftFiles} />

            <button
              type="button"
              disabled={busy || !draft.to.trim() || (!draft.text.trim() && draftFiles.length === 0)}
              onClick={() => void sendNew()}
              style={{ ...btnPrimary, marginTop: 6, opacity: busy || !draft.to.trim() || (!draft.text.trim() && draftFiles.length === 0) ? 0.5 : 1 }}
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </aside>
        </>
      ) : null}

      {searching ? (
        <EmailSearch threads={threads} onOpen={openThread} onClose={() => setSearching(false)} />
      ) : null}
    </>
  );
}

/**
 * One message in a conversation.
 *
 * Sent and received are told apart three ways at once — tint, which side the
 * block is indented from, and a word — because any one of them alone fails
 * somewhere. Colour alone fails if you cannot distinguish these two; indentation
 * alone collapses on a narrow screen, where there is no room to indent.
 */
function MessageBlock({ message }: { message: EmailMessage }) {
  const outbound = message.direction === 'outbound';
  // Deliberately not rendering the sender's HTML. Inbound mail is untrusted
  // markup from strangers, and injecting it here would run it on the same
  // origin as the admin session. The text part reads fine.
  const body = messageBody(message) || '(empty message)';
  const files = message.attachments.filter(a => !a.inline);

  return (
    <div
      className={outbound ? 'msg msg-out' : 'msg msg-in'}
      style={{
        borderRadius: 12,
        padding: '16px 18px',
        background: outbound ? c.blueTint : c.white,
        border: '0.5px solid ' + (outbound ? '#C3CFEC' : c.line),
        borderLeft: '3px solid ' + (outbound ? c.blue : c.bar)
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: outbound ? c.blue : c.ink, overflowWrap: 'anywhere' }}>
          <span
            style={{
              fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
              background: outbound ? c.blue : c.bar, color: outbound ? c.white : c.ink,
              padding: '3px 8px', borderRadius: 20, marginRight: 9, whiteSpace: 'nowrap'
            }}
          >
            {outbound ? 'Sent' : 'Received'}
          </span>
          {outbound ? 'You' : message.fromName ?? message.fromAddress}
          <span style={{ fontWeight: 300, color: c.soft }}>
            {' · ' + message.fromAddress}
            {outbound && message.sentBy ? ' (' + message.sentBy + ')' : ''}
          </span>
        </span>
        <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{shortDate(message.createdAt)}</span>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '72ch' }}>
        {body}
      </p>

      {files.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {files.map(a => (
            <a
              key={a.id}
              href={'/api/email/attachment?email=' + encodeURIComponent(message.resendId ?? '') + '&id=' + encodeURIComponent(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: c.blue,
                background: c.white, border: '0.7px solid ' + c.faintBorder, padding: '8px 13px',
                borderRadius: 8, textDecoration: 'none', maxWidth: '100%'
              }}
            >
              <span aria-hidden>📎</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.filename ?? 'attachment'}
              </span>
              <span style={{ color: c.soft, whiteSpace: 'nowrap' }}>{formatBytes(a.size)}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Chosen-but-not-yet-sent files, with a way to change your mind about each. */
function FilePicker({
  files, onChange, disabled, id
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  id: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const total = files.reduce((n, f) => n + f.size, 0);
  const overSize = total > MAX_TOTAL_ATTACHMENT_BYTES;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        id={id}
        ref={picker}
        type="file"
        multiple
        disabled={disabled}
        onChange={e => {
          // Appended, not replaced: picking a second time is almost always
          // "and this one too", and the native dialog cannot add to a selection.
          onChange([...files, ...Array.from(e.target.files ?? [])]);
          // Cleared so re-picking the same file fires change again.
          if (picker.current) picker.current.value = '';
        }}
        style={{ display: 'none' }}
      />

      {files.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {files.map((f, i) => (
            <span
              key={f.name + i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: c.bg,
                padding: '7px 8px 7px 12px', borderRadius: 8, maxWidth: '100%'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ color: c.soft }}>{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={'Remove ' + f.name}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 15, color: c.soft, lineHeight: 1, padding: '0 2px' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => picker.current?.click()}
          style={{ ...btnSecondary, padding: '9px 16px', fontSize: 14, opacity: disabled ? 0.5 : 1 }}
        >
          📎 Attach files
        </button>
        {files.length > 0 ? (
          <span style={{ fontSize: 12, color: overSize ? '#B3261E' : c.soft }}>
            {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(total)}
            {overSize ? ' — over the ' + formatBytes(MAX_TOTAL_ATTACHMENT_BYTES) + ' limit' : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
}
