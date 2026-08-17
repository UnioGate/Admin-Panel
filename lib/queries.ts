import { relative } from './format';
import { supabase } from './supabase';
import { listAdmins } from './admins';
import { listMailboxes } from './mailboxes';
import { canReadMailboxAddress, isSettled } from './data';
import type {
  Admin,
  ActivityEntry,
  AdminRole,
  Mailbox,
  Message,
  MessageStatus,
  WaitlistEntry
} from './data';

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
  mailbox: string | null;
};

export type ActivityResult = { entries: ActivityEntry[]; provisioned: boolean };

/**
 * Which mailbox an entry concerns, recovering it from the text for rows written
 * before the `mailbox` column existed. Two shapes are worth catching: the
 * address in "Sent email as …", and a mailbox-management entry, whose target is
 * the address itself.
 *
 * The second is matched against real mailboxes rather than by shape, so it
 * cannot fire on "Sent email as support@ — someone@elsewhere.com", where the
 * target is the correspondent and the mailbox is in the action.
 *
 * "Email received" keeps only the subject, so legacy inbound entries stay
 * visible to everyone — the same exposure those rows already had. Anything
 * written after the migration carries the column and never reaches this.
 */
function legacyMailbox(row: ActivityRow, known: Mailbox[]): string | null {
  if (row.mailbox) return row.mailbox;

  const sent = /^Sent email as (\S+@\S+)$/.exec(row.action);
  if (sent) return sent[1];

  const target = row.target?.trim().toLowerCase();
  if (row.kind === 'Email' && target && known.some(m => m.address === target)) return target;

  return null;
}

export async function fetchActivity(
  viewer: { email: string; role: AdminRole },
  limit = 200
): Promise<ActivityResult> {
  const [{ data, error }, { admins }, { mailboxes }] = await Promise.all([
    supabase
      .from('admin_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
    // For resolving the actor to a display name. Suspended admins are included
    // deliberately — the log is history, and history has people in it who can
    // no longer sign in.
    listAdmins().catch(() => ({ admins: [] as Admin[], provisioned: true })),
    listMailboxes().catch(() => ({ mailboxes: [] as Mailbox[], provisioned: true }))
  ]);

  if (error) {
    if (MISSING_TABLE.includes(error.code)) return { entries: [], provisioned: false };
    throw new Error('admin_activity: ' + error.message);
  }

  const names = new Map(admins.map(a => [a.email, a.name]));
  const now = Date.now();

  return {
    provisioned: true,
    entries: (data as ActivityRow[])
      // Mail is scoped to whoever holds the address, so the log beside it has
      // to be too: the action text carries subject lines and correspondents.
      .filter(r => {
        const box = legacyMailbox(r, mailboxes);
        return !box || canReadMailboxAddress(box, mailboxes, viewer);
      })
      .map(r => ({
        // Falls back to the raw address for anyone no longer on the allowlist,
        // and for inbound mail, where the actor is the stranger who wrote in.
        actor: names.get(r.actor) ?? r.actor,
        text: r.action + (r.target ? ' — ' + r.target : ''),
        when: relative(r.created_at, now),
        kind: r.kind
      }))
  };
}

/**
 * Best effort: an audit row must never be the reason a real action 500s, and
 * before the migration there is nowhere to write it. Returns whether it stuck.
 *
 * `mailbox` is what scopes the entry on the way back out. Set it on anything
 * that names a mailbox or describes its mail; leave it off and the entry is
 * visible to every admin.
 */
export async function recordActivity(entry: {
  actor: string;
  action: string;
  target?: string | null;
  kind?: string;
  mailbox?: string | null;
}): Promise<boolean> {
  const row = {
    actor: entry.actor,
    action: entry.action,
    target: entry.target ?? null,
    kind: entry.kind ?? 'System'
  };

  const { error } = await supabase
    .from('admin_activity')
    .insert({ ...row, mailbox: entry.mailbox ?? null });
  if (!error) return true;

  // Before sql/activity.sql has been run there is no `mailbox` column, and
  // rejecting the whole row would silently stop the audit log. Record it
  // without the scoping instead — an unscoped entry is worse than a scoped one
  // and much better than none, and it comes back once the migration lands.
  if (MISSING_COLUMN.includes(error.code)) {
    const retry = await supabase.from('admin_activity').insert(row);
    return !retry.error;
  }

  return false;
}
