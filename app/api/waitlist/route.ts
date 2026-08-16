import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchWaitlist, recordActivity, setWaitlistHidden } from '@/lib/queries';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json({ entries: await fetchWaitlist() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emails, action } = (await req.json()) as { emails: string[]; action: 'hide' | 'restore' };
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails required' }, { status: 400 });
  }
  if (action !== 'hide' && action !== 'restore') {
    return NextResponse.json({ error: 'action must be hide or restore' }, { status: 400 });
  }

  try {
    await setWaitlistHidden(emails, action === 'hide');
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const logged = await recordActivity({
    actor: session.email,
    action: action === 'hide' ? 'Hid waitlist record' : 'Restored waitlist record',
    target: emails.length === 1 ? emails[0] : emails.length + ' records',
    kind: 'Privacy'
  });

  return NextResponse.json({ ok: true, action, count: emails.length, logged });
}
