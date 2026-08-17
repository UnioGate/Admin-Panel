import { NextResponse } from 'next/server';
import { findAdmin } from '@/lib/admins';
import { requireAdmin } from '@/lib/auth';
import { canUseMailbox } from '@/lib/data';
import {
  createMailbox,
  deleteMailbox,
  findMailbox,
  listMailboxes,
  normaliseMailboxAddress,
  updateMailbox
} from '@/lib/mailboxes';
import { recordActivity } from '@/lib/queries';

// An address on the domain can send mail that looks like it came from the
// company, so creating one is as sensitive as granting console access — same
// rule, same gate: Owner only, and every write is logged.
async function requireOwner() {
  const session = await requireAdmin();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (session.role !== 'Owner') {
    return { error: NextResponse.json({ error: 'Only an Owner can manage mailboxes.' }, { status: 403 }) } as const;
  }
  return { session } as const;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { mailboxes, provisioned } = await listMailboxes();
    // A non-Owner has no business knowing which personal addresses exist, let
    // alone who holds them. Filtered on the server: hiding them in the UI would
    // still have shipped the list to the browser.
    return NextResponse.json({
      provisioned,
      mailboxes: mailboxes.filter(m => canUseMailbox(m, session))
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { address, label, assignedTo } = (await req.json()) as {
    address?: string;
    label?: string;
    assignedTo?: string | null;
  };

  const parsed = normaliseMailboxAddress(address ?? '');
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const assignee = await resolveAssignee(assignedTo);
  if ('error' in assignee) return NextResponse.json({ error: assignee.error }, { status: 400 });

  try {
    await createMailbox({
      address: parsed.address,
      label: label ?? '',
      assignedTo: assignee.email,
      createdBy: gate.session.email
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const logged = await recordActivity({
    actor: gate.session.email,
    action: assignee.email ? 'Created mailbox for ' + assignee.email : 'Created shared mailbox',
    target: parsed.address,
    kind: 'Email',
    // Who holds which address is Owner business, same as the mailbox list.
    mailbox: parsed.address
  });

  return NextResponse.json({ ok: true, address: parsed.address, logged });
}

export async function PATCH(req: Request) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { address, label, assignedTo, suspended } = (await req.json()) as {
    address?: string;
    label?: string;
    assignedTo?: string | null;
    suspended?: unknown;
  };

  const target = await findMailbox(address ?? '');
  if (!target) return NextResponse.json({ error: 'No such mailbox: ' + (address ?? '') }, { status: 404 });

  let nextAssignee: string | null | undefined;
  if (assignedTo !== undefined) {
    const assignee = await resolveAssignee(assignedTo);
    if ('error' in assignee) return NextResponse.json({ error: assignee.error }, { status: 400 });
    nextAssignee = assignee.email;
  }

  if (suspended !== undefined && typeof suspended !== 'boolean') {
    return NextResponse.json({ error: 'suspended must be true or false.' }, { status: 400 });
  }

  try {
    await updateMailbox(target.address, {
      label,
      assignedTo: nextAssignee,
      suspended: suspended as boolean | undefined
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  // A relabel is cosmetic. Who can send as an address, and whether it can send
  // at all, is not — so only those two reach the activity log.
  const action = suspended !== undefined
    ? (suspended ? 'Suspended mailbox' : 'Restored mailbox')
    : nextAssignee !== undefined
      ? (nextAssignee ? 'Assigned mailbox to ' + nextAssignee : 'Made mailbox shared')
      : null;

  const logged = action
    ? await recordActivity({
        actor: gate.session.email,
        action,
        target: target.address,
        kind: 'Email',
        mailbox: target.address
      })
    : false;

  return NextResponse.json({ ok: true, logged });
}

export async function DELETE(req: Request) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { address } = (await req.json()) as { address?: string };
  const target = await findMailbox(address ?? '');
  if (!target) return NextResponse.json({ error: 'No such mailbox: ' + (address ?? '') }, { status: 404 });

  // Logged before the delete: afterwards there is no row to point at, and
  // removing an address should leave a trail even if the write then fails.
  const logged = await recordActivity({
    actor: gate.session.email,
    action: 'Deleted mailbox',
    target: target.address,
    kind: 'Email',
    // Recorded against an address that is about to stop existing. `mailbox` is
    // plain text rather than a reference for exactly this reason.
    mailbox: target.address
  });

  try {
    await deleteMailbox(target.address);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, logged });
}

/**
 * An empty or absent assignee means shared, which is a real choice rather than
 * a missing value. Anything else has to be someone on the allowlist: assigning
 * an address to a person who cannot sign in would create a mailbox nobody but
 * an Owner could ever open.
 */
async function resolveAssignee(value: string | null | undefined): Promise<{ email: string | null } | { error: string }> {
  const wanted = (value ?? '').trim().toLowerCase();
  if (!wanted) return { email: null };

  const admin = await findAdmin(wanted);
  if (!admin) return { error: wanted + ' is not on the admin allowlist.' };
  return { email: admin.email };
}
