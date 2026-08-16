import { randomUUID } from 'crypto';
import { supabase } from './supabase';
import { ourAddresses } from './mailboxes';
import {
  addressOf,
  baseAddress,
  groupIntoThreads,
  inboundMailbox,
  normaliseSubject,
  parseAddress,
  threadFromRecipients,
  type EmailAttachment,
  type EmailMessage,
  type EmailThread
} from './email';

const MISSING_TABLE = ['42P01', 'PGRST205'];

type EmailRow = {
  id: string;
  thread_id: string;
  direction: 'inbound' | 'outbound';
  mailbox: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  html: string | null;
  text: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  resend_id: string | null;
  attachments: EmailAttachment[] | null;
  sent_by: string | null;
  read_at: string | null;
  created_at: string;
};

function toMessage(r: EmailRow): EmailMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    direction: r.direction,
    mailbox: r.mailbox,
    fromAddress: r.from_address,
    fromName: r.from_name,
    to: r.to_addresses ?? [],
    cc: r.cc_addresses ?? [],
    subject: r.subject ?? '',
    html: r.html,
    text: r.text,
    createdAt: r.created_at,
    readAt: r.read_at,
    sentBy: r.sent_by,
    resendId: r.resend_id,
    attachments: r.attachments ?? []
  };
}

export type ThreadsResult = { threads: EmailThread[]; provisioned: boolean };

/**
 * Threads are derived rather than stored. There is no `email_threads` table to
 * drift out of sync, at the cost of reading a window of messages and grouping
 * in memory — fine at this volume, and the limit keeps it bounded.
 */
export async function fetchThreads(limit = 500): Promise<ThreadsResult> {
  const [{ data, error }, ours] = await Promise.all([
    supabase
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
    // Needed to tell our own addresses from the people we are talking to.
    ourAddresses()
  ]);

  if (error) {
    if (MISSING_TABLE.includes(error.code)) return { threads: [], provisioned: false };
    throw new Error('emails: ' + error.message);
  }

  return {
    provisioned: true,
    threads: groupIntoThreads((data as EmailRow[]).map(toMessage), ours)
  };
}

export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('emails')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('direction', 'inbound')
    .is('read_at', null);
  if (error) throw new Error('emails: ' + error.message);
}

export async function markThreadUnread(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('emails')
    .update({ read_at: null })
    .eq('thread_id', threadId)
    .eq('direction', 'inbound');
  if (error) throw new Error('emails: ' + error.message);
}

/** Hard delete of a whole conversation. Owner only — the route enforces that. */
export async function deleteThread(threadId: string): Promise<void> {
  const { error } = await supabase.from('emails').delete().eq('thread_id', threadId);
  if (error) throw new Error('emails: ' + error.message);
}

export async function findResendId(resendId: string): Promise<boolean> {
  const { data, error } = await supabase.from('emails').select('id').eq('resend_id', resendId).limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/**
 * Works out which conversation an inbound message belongs to, in descending
 * order of reliability:
 *
 *   1. the `+t…` token we put in Reply-To on our own outbound mail
 *   2. In-Reply-To matching a Message-ID we have stored
 *   3. same normalised subject with the same correspondent, within 30 days
 *   4. a new thread
 *
 * Rule 3 is a heuristic and can be wrong — people reply to old mail by editing
 * the subject line — so it is deliberately last and time-boxed.
 */
async function resolveThread(input: {
  recipients: string[];
  inReplyTo: string | null;
  subject: string;
  fromAddress: string;
}): Promise<string> {
  const tokenThread = threadFromRecipients(input.recipients);
  if (tokenThread) return tokenThread;

  if (input.inReplyTo) {
    const { data } = await supabase
      .from('emails')
      .select('thread_id')
      .eq('message_id', input.inReplyTo)
      .limit(1);
    const hit = (data ?? [])[0] as { thread_id: string } | undefined;
    if (hit) return hit.thread_id;
  }

  const subject = normaliseSubject(input.subject);
  if (subject) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('emails')
      .select('thread_id, subject, from_address, to_addresses')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    const from = addressOf(input.fromAddress);
    const match = (data as Pick<EmailRow, 'thread_id' | 'subject' | 'from_address' | 'to_addresses'>[] | null)
      ?.find(r =>
        normaliseSubject(r.subject ?? '') === subject &&
        (baseAddress(r.from_address) === from || (r.to_addresses ?? []).some(t => baseAddress(t) === from))
      );
    if (match) return match.thread_id;
  }

  return randomUUID();
}

export async function insertInbound(email: {
  resendId: string;
  from: string;
  to: string[];
  cc: string[];
  receivedFor: string[];
  subject: string;
  html: string | null;
  text: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  attachments: EmailAttachment[];
  createdAt: string;
}): Promise<string> {
  const recipients = [...email.to, ...email.cc, ...email.receivedFor];
  const threadId = await resolveThread({
    recipients,
    inReplyTo: email.inReplyTo,
    subject: email.subject,
    fromAddress: email.from
  });

  const { name, address } = parseAddress(email.from);

  const { error } = await supabase.from('emails').insert({
    thread_id: threadId,
    direction: 'inbound',
    mailbox: inboundMailbox(recipients, await ourAddresses()),
    from_address: address,
    from_name: name,
    to_addresses: email.to.map(baseAddress),
    cc_addresses: email.cc.map(baseAddress),
    subject: email.subject,
    html: email.html,
    text: email.text,
    message_id: email.messageId,
    in_reply_to: email.inReplyTo,
    resend_id: email.resendId,
    attachments: email.attachments,
    created_at: email.createdAt
  });

  if (error) throw new Error('emails: ' + error.message);
  return threadId;
}

export async function insertOutbound(email: {
  threadId: string;
  mailbox: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string | null;
  resendId: string | null;
  sentBy: string;
}): Promise<void> {
  const { error } = await supabase.from('emails').insert({
    thread_id: email.threadId,
    direction: 'outbound',
    mailbox: email.mailbox,
    from_address: email.mailbox,
    from_name: null,
    to_addresses: email.to,
    cc_addresses: email.cc,
    subject: email.subject,
    text: email.text,
    html: email.html,
    resend_id: email.resendId,
    sent_by: email.sentBy,
    // Our own sends are never "unread" — read state only tracks inbound mail.
    read_at: new Date().toISOString()
  });

  if (error) throw new Error('emails: ' + error.message);
}

export async function unreadEmailCount(): Promise<number> {
  const { count, error } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}
