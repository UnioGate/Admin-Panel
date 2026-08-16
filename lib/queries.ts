import { relative } from './format';
import { supabase } from './supabase';
import { isSettled } from './data';
import type { ActivityEntry, Message, MessageStatus, WaitlistEntry } from './data';

// Postgres "relation does not exist" / PostgREST "table not in schema cache".
// Both mean the migration in the README has not been run yet.
const MISSING_TABLE = ['42P01', 'PGRST205'];
const MISSING_COLUMN = ['42703', 'PGRST204'];

type WaitlistRow = {
  id: number;
  created_at: string;
  email: string | null;
  unsubscribed: boolean;
  hidden_at?: string | null;
};

export async function fetchWaitlist(): Promise<WaitlistEntry[]> {
  // `select('*')` rather than a column list on purpose: `hidden_at` only exists
  // after the migration, and naming a column PostgREST cannot find rejects the
  // whole query. Rows without it simply read as never hidden.
  const { data, error } = await supabase
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error('waitlist: ' + error.message);

  return (data as WaitlistRow[]).map((r, i) => ({
    id: r.id,
    // Position is the signup order — the table has no stored rank.
    pos: i + 1,
    email: r.email ?? '',
    createdAt: r.created_at,
    unsubscribed: r.unsubscribed,
    hiddenAt: r.hidden_at ?? null
  }));
}

type MessageRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  message: string;
  topic: string | null;
  business: string | null;
  volume: string | null;
  status: string;
  handled_at: string | null;
  notes: string | null;
};

export async function fetchMessages(): Promise<Message[]> {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error('contact_messages: ' + error.message);

  return (data as MessageRow[])
    .map(r => ({
      id: r.id,
      createdAt: r.created_at,
      name: r.name,
      email: r.email,
      message: r.message,
      topic: r.topic,
      business: r.business,
      volume: r.volume,
      status: r.status,
      handledAt: r.handled_at,
      notes: r.notes
    }))
    // Anything still needing a reply floats to the top; dealt-with enquiries
    // sink. Sorted here rather than in the query because the grouping follows
    // `status` — which is what the inbox displays — and not `handled_at`, which
    // a write from outside the console could leave unset.
    .sort((a, b) => {
      const rank = (m: Message) => (isSettled(m.status) ? 1 : 0);
      // The DB already ordered by created_at descending, so a stable sort keeps
      // newest-first inside each group.
      return rank(a) - rank(b);
    });
}

export async function setMessageStatus(id: string, status: MessageStatus): Promise<void> {
  // `handled_at` marks the point an enquiry stopped needing a reply, so it is
  // set for the terminal states only — `in_progress` is still outstanding.
  const done = status === 'replied' || status === 'spam';

  const { error } = await supabase
    .from('contact_messages')
    .update({ status, handled_at: done ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    // 23514 is a check constraint violation, which here means the status
    // vocabulary in lib/data.ts has drifted from the database.
    if (error.code === '23514') {
      throw new Error('The database rejected the status "' + status + '".');
    }
    throw new Error('contact_messages: ' + error.message);
  }
}

/** Hard delete — Owner only. The route handler enforces that, not this. */
export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('contact_messages').delete().eq('id', id);
  if (error) throw new Error('contact_messages: ' + error.message);
}

export async function insertContactMessage(row: {
  name: string;
  email: string;
  message: string;
  topic?: string | null;
  business?: string | null;
  volume?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('contact_messages').insert({ ...row, status: 'new' });
  if (error) throw new Error('contact_messages: ' + error.message);
}

/** Soft delete. Requires the `hidden_at` column from the migration. */
export async function setWaitlistHidden(emails: string[], hide: boolean): Promise<void> {
  const { error } = await supabase
    .from('waitlist')
    .update({ hidden_at: hide ? new Date().toISOString() : null })
    .in('email', emails);

  if (error) {
    if (MISSING_COLUMN.includes(error.code)) {
      throw new Error('waitlist.hidden_at does not exist yet — run the migration in the README.');
    }
    throw new Error('waitlist: ' + error.message);
  }
}

type ActivityRow = {
  id: number;
  created_at: string;
  actor: string;
  action: string;
  target: string | null;
  kind: string;
};

export type ActivityResult = { entries: ActivityEntry[]; provisioned: boolean };

export async function fetchActivity(limit = 200): Promise<ActivityResult> {
  const { data, error } = await supabase
    .from('admin_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (MISSING_TABLE.includes(error.code)) return { entries: [], provisioned: false };
    throw new Error('admin_activity: ' + error.message);
  }

  const now = Date.now();
  return {
    provisioned: true,
    entries: (data as ActivityRow[]).map(r => ({
      text: r.action + (r.target ? ' — ' + r.target : ''),
      when: relative(r.created_at, now),
      kind: r.kind
    }))
  };
}

/**
 * Best effort: an audit row must never be the reason a real action 500s, and
 * before the migration there is nowhere to write it. Returns whether it stuck.
 */
export async function recordActivity(entry: {
  actor: string;
  action: string;
  target?: string | null;
  kind?: string;
}): Promise<boolean> {
  const { error } = await supabase.from('admin_activity').insert({
    actor: entry.actor,
    action: entry.action,
    target: entry.target ?? null,
    kind: entry.kind ?? 'System'
  });
  return !error;
}
