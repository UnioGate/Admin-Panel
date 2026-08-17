'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import EmailSearch from '@/components/EmailSearch';
import PageHeader from '@/components/PageHeader';
import { Btn, Field, Icon, Tag, field, micro } from '@/components/ui';
import {
  formatBytes, MAX_TOTAL_ATTACHMENT_BYTES, messageBody, quoteForReply, replySubject, threadInFolder,
  type EmailFolder, type EmailMessage, type EmailThread
} from '@/lib/email';
import { relative, shortDate } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { c, display } from '@/lib/theme';

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
  // Which pane a single-column layout is showing. Ignored above 1024px, where
  // both panes are on screen at once.
  const [showDetail, setShowDetail] = useState(false);
  // The composer starts as one line. Expanded it is the tallest thing in the
  // pane, and most visits to a conversation are to read it, not to answer it.
  const [replyOpen, setReplyOpen] = useState(false);
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
      setReplyOpen(false);
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
    setReplyOpen(false);
    setOpenId(threadId);
    setShowDetail(true);
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
        <div className="section-stack">
          <div style={{ maxWidth: 680, background: c.white, border: '0.7px solid ' + c.faintBorder, borderRadius: 10, padding: '26px 28px 28px' }}>
            <div style={{ ...micro, color: c.blue, marginBottom: 12 }}>Blocked</div>
            <h2 style={{ margin: '0 0 16px', fontFamily: display, fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {!configured
                ? 'Resend is not configured'
                : !provisioned
                  ? 'The emails table does not exist yet'
                  : 'The mailboxes table does not exist yet'}
            </h2>
            <div style={{ borderTop: '0.7px solid ' + c.faintBorder, margin: '0 0 18px' }} />
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, fontWeight: 300, color: c.muted }}>
              {!configured ? (
                <>
                  Set <code>RESEND_API_KEY</code> and <code>RESEND_WEBHOOK_SECRET</code> in <code>.env.local</code> and
                  restart the dev server. The README has the DNS and webhook steps that go with them.
                </>
              ) : !provisioned ? (
                <>Run <code>sql/emails.sql</code> in the Supabase SQL editor, then reload.</>
              ) : (
                <>
                  Run <code>sql/mailboxes.sql</code> in the Supabase SQL editor, then reload. It holds the
                  addresses this console can send and receive as — they used to live in <code>EMAIL_MAILBOXES</code>.
                </>
              )}
            </p>
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

      {/* One bar. Folder first — which half of the conversation you want is a
          bigger question than which address it came through — then the mailbox
          as a select, because a pill per address never fitted a phone and never
          fitted more than about three mailboxes anyway. */}
      <div className="mail-toolbar" style={{ background: c.white, borderBottom: '0.7px solid ' + c.faintBorder }}>
        <div
          className="seg-group"
          role="group"
          aria-label="Folder"
          style={{ border: '0.7px solid ' + c.blue, borderRadius: 24, overflow: 'hidden', background: c.white }}
        >
          {([
            ['all', 'All', counts.all],
            ['inbox', 'Inbox', counts.inbox],
            ['sent', 'Sent', counts.sent]
          ] as const).map(([key, label, n], i) => {
            const on = folder === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => { setFolder(key); setOpenId(null); setShowDetail(false); }}
                style={{
                  background: on ? c.blue : 'transparent', color: on ? c.white : c.blue,
                  border: 0, borderLeft: i === 0 ? 0 : '1px solid ' + c.blue, borderRadius: 0,
                  padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  // 44px: the smallest thing a thumb hits reliably, and this is
                  // the control a phone reaches for most.
                  display: 'flex', gap: 9, alignItems: 'center', whiteSpace: 'nowrap', minHeight: 44
                }}
              >
                {label}
                <span style={{ fontSize: 11, letterSpacing: '0.08em', opacity: 0.7 }}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* One mailbox means a select of one — not worth the space. */}
        {readableMailboxes.length > 1 ? (
          <select
            className="mb-select"
            value={mailbox}
            aria-label="Mailbox"
            onChange={e => { setMailbox(e.target.value); setOpenId(null); setShowDetail(false); }}
            style={{ ...field, width: 'auto', minWidth: 210, fontSize: 14, minHeight: 44, border: '0.7px solid ' + c.faintBorder }}
          >
            <option value="All">All mailboxes</option>
            {readableMailboxes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : null}

        <div className="tool-actions">
          <Btn kind="ghost" onClick={() => setSearching(true)} style={{ minHeight: 44 }}>
            {Icon.search(14)} Search
            <kbd className="hide-sm" style={{ fontSize: 10, letterSpacing: '0.08em', fontWeight: 500, color: c.soft, background: c.bg, borderRadius: 5, padding: '3px 6px', fontFamily: 'inherit' }}>
              ⌘K
            </kbd>
          </Btn>

          <Btn
            kind="primary"
            disabled={!canSend}
            onClick={() => setComposing(true)}
            title={canSend ? undefined : 'You have no mailbox that can send. An Owner assigns one in Settings.'}
            style={{ minHeight: 44, opacity: canSend ? 1 : 0.5 }}
          >
            New message
          </Btn>
        </div>
      </div>

      {/* data-view only matters below 1024px, where one pane shows at a time. */}
      <div className="mail-app" data-view={showDetail && open ? 'detail' : 'list'}>
        <div className="mail-col mail-col-list" style={{ background: c.white }}>
          <div style={{ padding: '13px 18px', borderBottom: '0.7px solid ' + c.faintBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={micro}>{folder === 'inbox' ? 'Inbox' : folder === 'sent' ? 'Sent' : 'All mail'}</span>
            <span style={{ fontSize: 12, color: c.soft }}>
              {visible.length} shown{unread ? ' · ' + unread + ' unread' : ''}
            </span>
          </div>

          <div className="mail-scroll">
          {visible.length === 0 ? (
            <div style={{ padding: '26px 22px', fontSize: 15, color: c.muted, fontWeight: 300, lineHeight: 1.65 }}>
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
                onClick={() => {
                  setOpenId(t.id);
                  setShowDetail(true);
                  setConfirmDelete(false);
                  setReply('');
                  setReplyFiles([]);
                  setReplyOpen(false);
                  if (t.unread) void setRead(t.id, true);
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: on ? '#F4F6FA' : c.white, border: 0, borderRadius: 0,
                  borderBottom: '0.5px solid ' + c.line,
                  borderLeft: '3px solid ' + (on ? c.blue : t.unread ? c.bar : 'transparent'),
                  padding: '16px 18px'
                }}
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
                    <span style={{ ...micro, marginRight: 6 }}>{t.lastDirection === 'inbound' ? 'From' : 'To'}</span>
                    {t.correspondents[0] ?? 'Unknown sender'}
                  </span>
                  <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{relative(t.lastActivity)}</span>
                </div>

                <div style={{ fontSize: 14, color: c.blue, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject}
                </div>

                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 9, flexWrap: 'wrap' }}>
                  {/* Only while looking at all of them — filtered to one, every
                      row would carry the same chip. */}
                  {mailbox === 'All' && t.mailbox ? <Tag>{t.mailbox}</Tag> : null}

                  {/* Otherwise the only way to find out a conversation has a
                      file is to open it. */}
                  {t.attachmentCount > 0 ? (
                    <span
                      title={t.attachmentCount + ' attachment' + (t.attachmentCount === 1 ? '' : 's')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: c.muted }}
                    >
                      {Icon.clip(12)} {t.attachmentCount}
                    </span>
                  ) : null}

                  {/* The state of a conversation we started: still waiting, or
                      they came back. Without this, Sent is a list of things you
                      cannot tell apart. */}
                  {t.hasOutbound && t.awaitingReply ? <Tag tone="quiet">Awaiting reply</Tag> : null}
                  {t.weStarted && t.hasInbound ? <Tag tone="tint">Replied</Tag> : null}

                  {t.messages.length > 1 ? (
                    <span style={{ fontSize: 11, color: c.soft }}>{t.messages.length} messages</span>
                  ) : null}
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <div className="mail-col mail-col-detail" style={{ background: c.bg }}>
          {open ? (
            <>
              <div className="mail-pad" style={{ background: c.white, borderBottom: '0.7px solid ' + c.faintBorder, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Only where the list is not on screen beside this. */}
                  <Btn kind="ghost" className="only-sm" onClick={() => setShowDetail(false)} style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }}>
                    {Icon.back(13)} All conversations
                  </Btn>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
                    <Btn kind="ghost" disabled={busy} onClick={() => void setRead(open.id, false)} style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }}>
                      Mark unread
                    </Btn>
                    {canDelete ? (
                      confirmDelete ? (
                        <>
                          <Btn kind="dangerSolid" disabled={busy} onClick={() => void removeThread(open.id)} style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }}>
                            Delete for good
                          </Btn>
                          <Btn kind="ghost" onClick={() => setConfirmDelete(false)} style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }}>
                            Cancel
                          </Btn>
                        </>
                      ) : (
                        <Btn kind="danger" disabled={busy} onClick={() => setConfirmDelete(true)} style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }}>
                          Delete
                        </Btn>
                      )
                    ) : null}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, lineHeight: 1.2, fontWeight: 600, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>
                    {open.subject}
                  </h2>
                  <div style={{ fontSize: 13, color: c.muted, marginTop: 7, fontWeight: 300, overflowWrap: 'anywhere' }}>
                    {open.correspondents.join(', ') || 'No correspondents'}
                    {open.mailbox ? ' · via ' + open.mailbox : ''}
                  </div>
                </div>
              </div>

              <div className="mail-scroll">
                <div className="mail-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {open.messages.map(m => <MessageBlock key={m.id} message={m} />)}
                </div>
              </div>

              <div className="mail-pad" style={{ background: c.white, borderTop: '0.7px solid ' + c.faintBorder }}>
                {!replyFrom ? (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 300, color: c.muted }}>
                    {/* No silent substitution: replying from a different address
                        than the one they wrote to would look like a stranger
                        barging into the conversation. */}
                    {(open.mailbox ?? 'This mailbox') + ' cannot send — it is suspended, or it is not one of yours.'}
                  </p>
                ) : !replyOpen ? (
                  <button
                    type="button"
                    onClick={() => setReplyOpen(true)}
                    style={{ ...field, display: 'flex', alignItems: 'center', gap: 9, minHeight: 46, cursor: 'text', textAlign: 'left', color: c.soft, border: '0.7px solid ' + c.faintBorder }}
                  >
                    {Icon.reply(14)} Reply to {open.correspondents[0] ?? 'this conversation'}…
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={micro}>Replying as {replyFrom}</span>
                      <button
                        type="button"
                        onClick={() => { setReplyOpen(false); setReply(''); setReplyFiles([]); }}
                        style={{ background: 'transparent', border: 0, padding: 0, fontSize: 13, color: c.soft, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Discard
                      </button>
                    </div>

                    <textarea
                      rows={4}
                      autoFocus
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Write a reply…"
                      style={{ ...field, resize: 'vertical', lineHeight: 1.6 }}
                    />

                    <FilePicker id="reply-files" files={replyFiles} onChange={setReplyFiles} />

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Btn
                        kind="primary"
                        disabled={busy || (!reply.trim() && replyFiles.length === 0) || open.correspondents.length === 0}
                        onClick={() => void sendReply()}
                        style={{ padding: '11px 24px', minHeight: 44, opacity: busy || (!reply.trim() && replyFiles.length === 0) ? 0.5 : 1 }}
                      >
                        {busy ? 'Sending…' : 'Send reply'}
                      </Btn>
                      <Btn onClick={() => setReply(r => r + quoteForReply(open.messages[open.messages.length - 1]))} style={{ minHeight: 44 }}>
                        Quote last message
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="mail-pad" style={{ fontSize: 15, color: c.muted, fontWeight: 300 }}>
              Select a conversation, or start a new one.
            </div>
          )}
        </div>
      </div>

      {composing ? (
        <>
          <div onClick={() => setComposing(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,42,0.45)', zIndex: 44 }} />
          <aside
            className="drawer"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, background: c.white, zIndex: 45,
              overflowY: 'auto', padding: '28px 32px 36px', borderLeft: '0.7px solid ' + c.faintBorder,
              boxShadow: '-18px 0 50px rgba(16,24,42,0.22)', display: 'flex', flexDirection: 'column', gap: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <div style={{ ...micro, color: c.blue, marginBottom: 8 }}>Compose</div>
                <h2 style={{ margin: 0, fontFamily: display, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>New message</h2>
              </div>
              <button
                type="button"
                onClick={() => setComposing(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: '0.7px solid ' + c.faintBorder, width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', color: c.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {Icon.close(14)}
              </button>
            </div>
            <div style={{ borderTop: '0.7px solid ' + c.faintBorder }} />

            <Field label="From">
              <select value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} style={{ ...field, padding: '11px 10px' }}>
                {mailboxes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="To (comma separated)">
              <input value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} style={field} />
            </Field>
            <Field label="Cc">
              <input value={draft.cc} onChange={e => setDraft({ ...draft, cc: e.target.value })} style={field} />
            </Field>
            <Field label="Subject">
              <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} style={field} />
            </Field>
            <Field label="Message">
              <textarea
                rows={12}
                value={draft.text}
                onChange={e => setDraft({ ...draft, text: e.target.value })}
                style={{ ...field, resize: 'vertical', lineHeight: 1.6 }}
              />
            </Field>
            <Field label="Attachments">
              <FilePicker id="draft-files" files={draftFiles} onChange={setDraftFiles} />
            </Field>

            <Btn
              kind="primary"
              disabled={busy || !draft.to.trim() || (!draft.text.trim() && draftFiles.length === 0)}
              onClick={() => void sendNew()}
              style={{ marginTop: 8, padding: '13px 26px', opacity: busy || !draft.to.trim() || (!draft.text.trim() && draftFiles.length === 0) ? 0.5 : 1 }}
            >
              {busy ? 'Sending…' : 'Send'}
            </Btn>
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
        border: '1px solid ' + (outbound ? '#C3CFEC' : c.faintBorder),
        borderLeft: '3px solid ' + (outbound ? c.blue : c.bar)
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: 14, fontWeight: 500, color: outbound ? c.blue : c.ink, overflowWrap: 'anywhere' }}>
          <Tag tone={outbound ? 'accent' : 'neutral'}>{outbound ? 'Sent' : 'Received'}</Tag>
          {outbound ? 'You' : message.fromName ?? message.fromAddress}
          <span style={{ fontWeight: 300, color: c.soft }}>
            {message.fromAddress}
            {outbound && message.sentBy ? ' (' + message.sentBy + ')' : ''}
          </span>
        </span>
        <span style={{ fontSize: 12, color: c.soft, whiteSpace: 'nowrap' }}>{shortDate(message.createdAt)}</span>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '72ch' }}>
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
              {Icon.clip(13)}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                border: '0.7px solid ' + c.faintBorder, borderRadius: 8,
                padding: '7px 8px 7px 12px', maxWidth: '100%'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ color: c.soft }}>{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={'Remove ' + f.name}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: c.soft, lineHeight: 1, padding: '0 2px', display: 'inline-flex', alignItems: 'center' }}
              >
                {Icon.close(14)}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Btn kind="ghost" disabled={disabled} onClick={() => picker.current?.click()} style={{ padding: '9px 16px', fontSize: 13, opacity: disabled ? 0.5 : 1 }}>
          {Icon.clip(14)} Attach files
        </Btn>
        {files.length > 0 ? (
          <span style={{ fontSize: 12, color: overSize ? c.danger : c.soft }}>
            {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(total)}
            {overSize ? ' — over the ' + formatBytes(MAX_TOTAL_ATTACHMENT_BYTES) + ' limit' : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
}
