import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { MESSAGE_STATUSES, MESSAGE_STATUS_LABELS, isMessageStatus } from '@/lib/data';
import { deleteMessage, fetchMessages, recordActivity, setMessageStatus } from '@/lib/queries';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json({ messages: await fetchMessages() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, status } = (await req.json()) as { id?: string; status?: unknown };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!isMessageStatus(status)) {
    return NextResponse.json(
      { error: 'status must be one of: ' + MESSAGE_STATUSES.join(', ') },
      { status: 400 }
    );
  }

  try {
    await setMessageStatus(id, status);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const logged = await recordActivity({
    actor: session.email,
    action: 'Set enquiry to ' + MESSAGE_STATUS_LABELS[status],
    target: id,
    kind: 'Inbox'
  });

  return NextResponse.json({ ok: true, logged });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Deleting an enquiry destroys the only record of it — there is no soft
  // delete here as there is for waitlist rows — so it is Owner only. Hiding the
  // button is a courtesy; this is the check that counts.
  if (session.role !== 'Owner') {
    return NextResponse.json({ error: 'Only an Owner can delete enquiries.' }, { status: 403 });
  }

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Logged before the delete: afterwards the id points at nothing, and an
  // unrecoverable action should leave a trail even if the write then fails.
  const logged = await recordActivity({
    actor: session.email,
    action: 'Deleted enquiry',
    target: id,
    kind: 'Inbox'
  });

  try {
    await deleteMessage(id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, logged });
}
