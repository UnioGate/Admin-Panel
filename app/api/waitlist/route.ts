import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { WAITLIST } from '@/lib/data';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // TODO: select * from waitlist where hidden_at is null order by position;
  return NextResponse.json({ entries: WAITLIST });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emails, action } = (await req.json()) as { emails: string[]; action: 'hide' | 'restore' };
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails required' }, { status: 400 });
  }

  // TODO: soft delete — set hidden_at = now() (or null to restore), then write an audit row:
  //   insert into admin_activity (actor, action, target, kind) values (session.email, action, ..., 'Privacy')
  // A scheduled job anonymises rows whose hidden_at is older than 30 days.
  return NextResponse.json({ ok: true, action, count: emails.length, actor: session.email });
}
