import { supabase } from './supabase';
import { EMAIL_DOMAIN } from './resend';
import type { Mailbox } from './data';

// The addresses this console owns, in Supabase. Like the admin allowlist, this
// is the single source — EMAIL_MAILBOXES is gone, and there is no fallback: if
// the table is missing there are no mailboxes, which the email page reports
// rather than papering over.
//
// Read with the service role key, so nothing here may run in the browser.

const MISSING_TABLE = ['42P01', 'PGRST205'];

type MailboxRow = {
  address: string;
  label: string | null;
  assigned_to: string | null;
  suspended_at: string | null;
  created_at: string;
};

function toMailbox(r: MailboxRow): Mailbox {
  return {
    address: r.address,
    label: r.label ?? '',
    assignedTo: r.assigned_to,
    suspendedAt: r.suspended_at,
    createdAt: r.created_at
  };
}

export type MailboxList = { mailboxes: Mailbox[]; provisioned: boolean };

/**
 * Every mailbox, suspended ones included. Callers filter — Settings needs to
 * show a suspended address in order to un-suspend it.
 *
 * `provisioned` false means the table does not exist, which is a different
 * problem from having no mailboxes and needs a different message.
 */
export async function listMailboxes(): Promise<MailboxList> {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('*')
    .order('assigned_to', { ascending: true, nullsFirst: true })
    .order('address', { ascending: true });

  if (error) {
    if (MISSING_TABLE.includes(error.code)) return { mailboxes: [], provisioned: false };
    throw new Error('mailboxes: ' + error.message);
  }

  return { mailboxes: (data as MailboxRow[]).map(toMailbox), provisioned: true };
}

/**
 * Just the addresses, for threading. Suspended ones count: an address we own is
 * ours whether or not it can currently send, and treating it as a stranger
 * would put our own mail in the correspondent list.
 */
export async function ourAddresses(): Promise<string[]> {
  const { mailboxes } = await listMailboxes();
  return mailboxes.map(m => m.address);
}

export async function findMailbox(address: string): Promise<Mailbox | null> {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('*')
    .eq('address', address.trim().toLowerCase())
    .limit(1);

  if (error) return null;
  const row = (data as MailboxRow[])[0];
  return row ? toMailbox(row) : null;
}

/**
 * Normalises what someone typed into an address on the sending domain, or says
 * why it cannot be one. A bare local part gets the domain appended, because
 * "chidile" is what an Owner will actually type.
 *
 * The domain is not negotiable: Resend can only send as a domain it has
 * verified, so an address anywhere else would be created here and then fail at
 * the point of use — better to refuse it now with a reason.
 */
export function normaliseMailboxAddress(input: string): { address: string } | { error: string } {
  const raw = input.trim().toLowerCase();
  if (!raw) return { error: 'Enter an address.' };

  const address = raw.includes('@') ? raw : raw + '@' + EMAIL_DOMAIN;
  const [local, domain, ...rest] = address.split('@');

  if (rest.length || !local || !domain) return { error: 'Not a valid address: ' + raw };
  if (domain !== EMAIL_DOMAIN) {
    return { error: 'Mailboxes must be on ' + EMAIL_DOMAIN + ' — that is the domain Resend can send as.' };
  }
  // `+` is reserved: outbound mail carries the thread id as `local+t<id>@`, and
  // a local part containing one would make the two impossible to tell apart.
  if (local.includes('+')) return { error: 'A mailbox address cannot contain "+".' };
  if (!/^[a-z0-9._-]+$/.test(local)) {
    return { error: 'Use letters, numbers, dots, dashes and underscores before the @.' };
  }

  return { address };
}

export async function createMailbox(entry: {
  address: string;
  label: string;
  assignedTo: string | null;
  createdBy: string;
}): Promise<void> {
  const { error } = await supabase.from('mailboxes').insert({
    address: entry.address,
    label: entry.label.trim() || entry.address.split('@')[0],
    assigned_to: entry.assignedTo,
    created_by: entry.createdBy
  });

  if (error) {
    if (error.code === '23505') throw new Error(entry.address + ' already exists.');
    throw new Error('mailboxes: ' + error.message);
  }
}

export async function updateMailbox(
  address: string,
  patch: { label?: string; assignedTo?: string | null; suspended?: boolean }
): Promise<void> {
  const fields: Record<string, string | null> = {};
  if (patch.label !== undefined) fields.label = patch.label.trim() || address.split('@')[0];
  // Distinguish "not mentioned" from "set to null": null is a real value here,
  // and it is how a personal mailbox is handed back to the team.
  if (patch.assignedTo !== undefined) fields.assigned_to = patch.assignedTo;
  if (patch.suspended !== undefined) fields.suspended_at = patch.suspended ? new Date().toISOString() : null;
  if (Object.keys(fields).length === 0) return;

  const { error } = await supabase.from('mailboxes').update(fields).eq('address', address);
  if (error) throw new Error('mailboxes: ' + error.message);
}

export async function deleteMailbox(address: string): Promise<void> {
  const { error } = await supabase.from('mailboxes').delete().eq('address', address);
  if (error) throw new Error('mailboxes: ' + error.message);
}

/**
 * Called when an admin is removed. Their addresses are suspended and detached
 * rather than deleted or left assigned to a ghost.
 *
 * Not made shared: an address that was one person's should not silently become
 * readable by every admin the moment that person leaves. An Owner can hand it
 * to someone else, or re-open it as shared, deliberately.
 */
export async function orphanMailboxesOf(email: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('mailboxes')
    .update({ assigned_to: null, suspended_at: new Date().toISOString() })
    .eq('assigned_to', email)
    .select('address');

  // The mailbox table not existing must not block removing someone's access.
  if (error) return [];
  return (data as { address: string }[]).map(r => r.address);
}
