import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deleteThread, fetchThreads, markThreadRead, markThreadUnread } from '@/lib/email-queries';
import { recordActivity } from '@/lib/queries';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await fetchThreads());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { threadId, read } = (await req.json()) as { threadId?: string; read?: unknown };
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });
  if (typeof read !== 'boolean') {
    return NextResponse.json({ error: 'read must be a boolean' }, { status: 400 });
  }

  try {
    if (read) await markThreadRead(threadId);
    else await markThreadUnread(threadId);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Deleting a conversation destroys correspondence with a real person and
  // there is no soft delete to recover it from, so it matches the enquiry
  // inbox: Owner only, enforced here rather than by hiding the button.
  if (session.role !== 'Owner') {
    return NextResponse.json({ error: 'Only an Owner can delete conversations.' }, { status: 403 });
  }

  const { threadId } = (await req.json()) as { threadId?: string };
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });

  // Logged first: afterwards there is nothing left to describe.
  const logged = await recordActivity({
    actor: session.email,
    action: 'Deleted email conversation',
    target: threadId,
    kind: 'Email'
  });

  try {
    await deleteThread(threadId);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, logged });
}
