// Types and pure helpers for the email console. Nothing here touches the
// network or the database, so the threading rules can be reasoned about (and
// tested) on their own.

export type EmailAttachment = {
  id: string;
  filename: string | null;
  contentType: string;
  size: number;
  inline: boolean;
};

export type EmailMessage = {
  id: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  mailbox: string | null;
  fromAddress: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string;
  html: string | null;
  text: string | null;
  createdAt: string;
  readAt: string | null;
  sentBy: string | null;
  resendId: string | null;
  attachments: EmailAttachment[];
};

export type EmailThread = {
  id: string;
  subject: string;
  mailbox: string | null;
  /** Everyone on the thread who is not one of our own addresses. */
  correspondents: string[];
  messages: EmailMessage[];
  lastActivity: string;
  unread: number;
  /** Somebody wrote to us on this thread, so it belongs in Inbox. */
  hasInbound: boolean;
  /** We wrote on this thread, so it belongs in Sent. A conversation that ran
      both ways is in both folders — that is what every mail client does, and
      splitting it in two would tear the conversation apart. */
  hasOutbound: boolean;
  /** We sent the first message. Used to tell a reply we are still waiting on
      from an enquiry we have not answered. */
  weStarted: boolean;
  /** We spoke last. On a thread we started that means nobody has come back. */
  awaitingReply: boolean;
};

/** The two folders a thread can appear in. `all` is the unfiltered view. */
export const EMAIL_FOLDERS = ['all', 'inbox', 'sent'] as const;
export type EmailFolder = (typeof EMAIL_FOLDERS)[number];

export function threadInFolder(thread: EmailThread, folder: EmailFolder): boolean {
  if (folder === 'inbox') return thread.hasInbound;
  if (folder === 'sent') return thread.hasOutbound;
  return true;
}

/** `"Ada Lovelace <ada@example.com>"` → name and address, either of which may be absent. */
export function parseAddress(raw: string): { name: string | null; address: string } {
  const angled = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1].replace(/^["']|["']$/g, '').trim();
    return { name: name || null, address: angled[2].trim().toLowerCase() };
  }
  return { name: null, address: raw.trim().toLowerCase() };
}

export function addressOf(raw: string): string {
  return parseAddress(raw).address;
}

/** `"Re: Fwd: Pricing"` → `"pricing"`. Used only as a last-resort thread match. */
export function normaliseSubject(subject: string): string {
  return subject
    // Repeated, because a subject that has been round-tripped a few times
    // arrives as "Re: Fwd: Re: …" and all of those are the same conversation.
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Threading by In-Reply-To alone is unreliable: Resend assigns the Message-ID
// on our outbound mail and does not hand it back, so a reply to something we
// sent has nothing on our side to match against. Instead every outbound message
// carries a Reply-To with the thread encoded in a plus-address. The catch-all
// MX means `support+t<token>@` is delivered exactly like `support@`, and the
// token comes back to us in the recipient list.

const TOKEN = /\+t([0-9a-f]{32})@/i;

export function replyToAddress(mailbox: string, threadId: string): string {
  const [local, domain] = mailbox.split('@');
  return local + '+t' + threadId.replace(/-/g, '') + '@' + domain;
}

/** Recovers the thread id from any recipient carrying a `+t…` token. */
export function threadFromRecipients(recipients: string[]): string | null {
  for (const raw of recipients) {
    const hit = TOKEN.exec(addressOf(raw));
    if (!hit) continue;
    const hex = hit[1].toLowerCase();
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  }
  return null;
}

/** Strips the `+t…` token so the UI shows `support@` rather than the routing address. */
export function baseAddress(address: string): string {
  return addressOf(address).replace(/\+t[0-9a-f]{32}(?=@)/i, '');
}

/** Which of our own addresses an inbound message arrived at, if any. */
export function inboundMailbox(recipients: string[], ours: string[]): string | null {
  for (const raw of recipients) {
    const base = baseAddress(raw);
    if (ours.includes(base)) return base;
  }
  // Delivered to the catch-all at an address we do not have configured. Keep it
  // rather than drop it — the mail is real either way.
  const first = recipients[0] ? baseAddress(recipients[0]) : '';
  return first || null;
}

/** Everyone on the thread who is not us, newest correspondent last. */
export function correspondentsOf(messages: EmailMessage[], ours: string[]): string[] {
  const seen: string[] = [];
  for (const m of messages) {
    for (const raw of [m.fromAddress, ...m.to, ...m.cc]) {
      const base = baseAddress(raw);
      if (!base || ours.includes(base) || seen.includes(base)) continue;
      seen.push(base);
    }
  }
  return seen;
}

export function threadSubject(messages: EmailMessage[]): string {
  const first = messages.find(m => m.subject.trim());
  return first?.subject.trim() || '(no subject)';
}

/** Groups a flat, newest-first message list into threads, newest thread first. */
export function groupIntoThreads(messages: EmailMessage[], ours: string[]): EmailThread[] {
  const byThread = new Map<string, EmailMessage[]>();
  for (const m of messages) {
    const bucket = byThread.get(m.threadId);
    if (bucket) bucket.push(m);
    else byThread.set(m.threadId, [m]);
  }

  return [...byThread.entries()]
    .map(([id, group]) => {
      // Oldest first inside a thread — it reads as a conversation.
      const ordered = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = ordered[ordered.length - 1];
      return {
        id,
        subject: threadSubject(ordered),
        mailbox: ordered.find(m => m.mailbox)?.mailbox ?? null,
        correspondents: correspondentsOf(ordered, ours),
        messages: ordered,
        lastActivity: last.createdAt,
        unread: ordered.filter(m => m.direction === 'inbound' && !m.readAt).length,
        hasInbound: ordered.some(m => m.direction === 'inbound'),
        hasOutbound: ordered.some(m => m.direction === 'outbound'),
        weStarted: ordered[0].direction === 'outbound',
        awaitingReply: last.direction === 'outbound'
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/** Quotes the message being replied to, the way every mail client does. */
export function quoteForReply(message: EmailMessage): string {
  const body = (message.text ?? stripHtml(message.html ?? '')).trim();
  const when = new Date(message.createdAt).toUTCString();
  const who = message.fromName ? message.fromName + ' <' + message.fromAddress + '>' : message.fromAddress;
  return '\n\nOn ' + when + ', ' + who + ' wrote:\n' + body.split('\n').map(l => '> ' + l).join('\n');
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function replySubject(subject: string): string {
  return /^\s*re\s*:/i.test(subject) ? subject : 'Re: ' + (subject || '(no subject)');
}
