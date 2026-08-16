import { NextResponse } from 'next/server';
import { addAdmin, findAdmin, listAdmins, ownerCount, removeAdmin, updateAdmin } from '@/lib/admins';
import { requireAdmin } from '@/lib/auth';
import { ADMIN_ROLES, isAdminRole, type AdminRole } from '@/lib/data';
import { orphanMailboxesOf } from '@/lib/mailboxes';
import { recordActivity } from '@/lib/queries';

// Who can open the console is the most sensitive thing in here: an admin who
// could edit this list could grant themselves anything. So every write is Owner
// only, and every write is logged.
async function requireOwner() {
  const session = await requireAdmin();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (session.role !== 'Owner') {
    return { error: NextResponse.json({ error: 'Only an Owner can change the allowlist.' }, { status: 403 }) } as const;
  }
  return { session } as const;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await listAdmins());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { email, name, role } = (await req.json()) as { email?: string; name?: string; role?: unknown };
  const address = (email ?? '').trim().toLowerCase();
  if (address.indexOf('@') < 1 || address.endsWith('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  // Default to Admin rather than to whatever was posted: an absent role should
  // not become the most powerful one.
  const wanted = role === undefined ? 'Admin' : role;
  if (!isAdminRole(wanted)) {
    return NextResponse.json({ error: 'role must be one of: ' + ADMIN_ROLES.join(', ') }, { status: 400 });
  }

  try {
    await addAdmin({ email: address, name: name ?? '', role: wanted, addedBy: gate.session.email });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const logged = await recordActivity({
    actor: gate.session.email,
    action: 'Added ' + wanted.toLowerCase() + ' to the allowlist',
    target: address,
    kind: 'Access'
  });

  return NextResponse.json({ ok: true, logged });
}

export async function PATCH(req: Request) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { email, name, role, suspended } = (await req.json()) as {
    email?: string;
    name?: string;
    role?: unknown;
    suspended?: unknown;
  };
  const address = (email ?? '').trim().toLowerCase();
  if (!address) return NextResponse.json({ error: 'email required' }, { status: 400 });

  let nextRole: AdminRole | undefined;
  if (role !== undefined) {
    if (!isAdminRole(role)) {
      return NextResponse.json({ error: 'role must be one of: ' + ADMIN_ROLES.join(', ') }, { status: 400 });
    }
    nextRole = role;
  }

  if (suspended !== undefined && typeof suspended !== 'boolean') {
    return NextResponse.json({ error: 'suspended must be true or false.' }, { status: 400 });
  }

  // Suspending yourself locks you out of the console that undoes it, so it is
  // refused rather than left as a trap — same reasoning as removing yourself.
  if (suspended === true && address === gate.session.email) {
    return NextResponse.json({ error: 'You cannot suspend your own access.' }, { status: 409 });
  }

  const target = await findAdmin(address);
  if (!target) return NextResponse.json({ error: address + ' is not on the allowlist.' }, { status: 404 });

  // Demoting or suspending the last Owner leaves a console nobody can
  // administer, and the only way back is editing the table by hand in Supabase.
  const losesOwner = (nextRole && nextRole !== 'Owner') || suspended === true;
  if (losesOwner && target.role === 'Owner' && !target.suspendedAt && (await ownerCount()) <= 1) {
    return NextResponse.json({ error: 'This is the last Owner. Promote someone else first.' }, { status: 409 });
  }

  try {
    await updateAdmin(address, { name, role: nextRole, suspended: suspended as boolean | undefined });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  // A rename is cosmetic; a role change or a suspension is not. Only log what
  // matters, or the activity feed becomes noise nobody reads.
  const action = suspended !== undefined
    ? (suspended ? 'Suspended access' : 'Restored access')
    : nextRole && nextRole !== target.role
      ? 'Changed role to ' + nextRole
      : null;

  const logged = action
    ? await recordActivity({ actor: gate.session.email, action, target: address, kind: 'Access' })
    : false;

  return NextResponse.json({ ok: true, logged });
}

export async function DELETE(req: Request) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { email } = (await req.json()) as { email?: string };
  const address = (email ?? '').trim().toLowerCase();
  if (!address) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Removing yourself works, right up until you reload — so it is refused
  // rather than left as a trap.
  if (address === gate.session.email) {
    return NextResponse.json({ error: 'You cannot remove your own access.' }, { status: 409 });
  }

  const target = await findAdmin(address);
  if (!target) return NextResponse.json({ error: address + ' is not on the allowlist.' }, { status: 404 });
  if (target.role === 'Owner' && !target.suspendedAt && (await ownerCount()) <= 1) {
    return NextResponse.json({ error: 'This is the last Owner. Promote someone else first.' }, { status: 409 });
  }

  // Logged before the delete: afterwards there is no row to point at, and
  // revoking access should leave a trail even if the write then fails.
  const logged = await recordActivity({
    actor: gate.session.email,
    action: 'Removed from the allowlist',
    target: address,
    kind: 'Access'
  });

  // Their personal addresses are suspended and detached before the row goes.
  // Deleting them would take months of conversations with them, and leaving
  // them assigned would point at somebody who no longer exists. Not made
  // shared either: an address that was one person's should not become
  // everybody's the moment they leave — an Owner reassigns it deliberately.
  const orphaned = await orphanMailboxesOf(address);

  try {
    await removeAdmin(address);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, logged, orphaned });
}
