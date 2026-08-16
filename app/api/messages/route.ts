import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchMessages, recordActivity, setMessageStatus } from '@/lib/queries';

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

  const { id, status } = (await req.json()) as { id: string; status: 'new' | 'handled' };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (status !== 'new' && status !== 'handled') {
    return NextResponse.json({ error: 'status must be new or handled' }, { status: 400 });
  }

  try {
    await setMessageStatus(id, status);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const logged = await recordActivity({
    actor: session.email,
    action: status === 'handled' ? 'Marked enquiry resolved' : 'Reopened enquiry',
    target: id,
    kind: 'Inbox'
  });

  return NextResponse.json({ ok: true, logged });
}
