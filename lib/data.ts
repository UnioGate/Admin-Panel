// Shapes the console renders. These mirror the real Supabase tables — the
// marketing site owns `waitlist` and `contact_messages`, so anything not in
// those tables is not something we can show.

export type WaitlistEntry = {
  id: number;
  pos: number;
  email: string;
  createdAt: string;
  unsubscribed: boolean;
  hiddenAt: string | null;
};

// contact_messages.status is constrained in the database
// (contact_messages_status_vals). Anything outside this set is rejected by
// Postgres, so this list is the authority for the whole console.
export const MESSAGE_STATUSES = ['new', 'in_progress', 'replied', 'spam'] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  replied: 'Replied',
  spam: 'Spam'
};

export function isMessageStatus(value: unknown): value is MessageStatus {
  return MESSAGE_STATUSES.includes(value as MessageStatus);
}

/**
 * No longer waiting on us. Drives both the `handled_at` stamp and the inbox
 * ordering, so the two cannot disagree about what "dealt with" means. An
 * unrecognised status counts as outstanding — better to surface it than bury it.
 */
export function isSettled(status: string): boolean {
  return status === 'replied' || status === 'spam';
}

export type Message = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  topic: string | null;
  business: string | null;
  volume: string | null;
  // Widened deliberately: rows predating the constraint could hold anything,
  // and the inbox should show them rather than crash on them.
  status: string;
  handledAt: string | null;
  notes: string | null;
};

// `admins.role` is constrained in the database, same as message statuses.
// Owner is the only role that may change the allowlist itself.
export const ADMIN_ROLES = ['Owner', 'Admin', 'Support'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return ADMIN_ROLES.includes(value as AdminRole);
}

export type Admin = {
  name: string;
  email: string;
  role: AdminRole;
  /** Set means the account is suspended: the row stays, the sign-in stops. */
  suspendedAt: string | null;
};

/**
 * An address on the sending domain. `assignedTo` is an admin's email, or null
 * for a shared mailbox like support@ — the difference decides who can see it.
 */
export type Mailbox = {
  address: string;
  label: string;
  assignedTo: string | null;
  /** Suspended: still receives and is still readable, but cannot send. */
  suspendedAt: string | null;
  createdAt: string;
};

/**
 * Who may read and send as a mailbox. An Owner sees everything — they
 * administer the domain. Everyone else gets the shared addresses plus their
 * own, which is what assigning one is for.
 */
export function canUseMailbox(box: Mailbox, viewer: { email: string; role: AdminRole }): boolean {
  if (viewer.role === 'Owner') return true;
  return box.assignedTo === null || box.assignedTo === viewer.email;
}

/**
 * Whether a viewer may read mail that came through an address, given the
 * mailboxes that currently exist. This is the read side of `canUseMailbox` and
 * it governs the message list, the unread badge and attachment downloads.
 *
 * An address with no mailbox row is Owner-only, and that covers two cases that
 * both want the same answer: catch-all mail delivered to an address nobody
 * configured, and mail belonging to a mailbox that has since been deleted. In
 * neither case is there anyone left to say who it was for, so it goes to the
 * people who administer the domain rather than to everyone.
 */
export function canReadMailboxAddress(
  address: string | null,
  mailboxes: Mailbox[],
  viewer: { email: string; role: AdminRole }
): boolean {
  if (viewer.role === 'Owner') return true;
  if (!address) return false;
  const box = mailboxes.find(m => m.address === address);
  return box ? canUseMailbox(box, viewer) : false;
}

export type ActivityEntry = { text: string; when: string; kind: string };
