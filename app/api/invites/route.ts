import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { emails } = (await req.json()) as { emails: string[] };
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails required' }, { status: 400 });
  }

  // TODO:
  // 1. Generate a 7-day activation token per address.
  // 2. Send through your transactional provider (Resend / Postmark / SES).
  // 3. Record invite_sent events so the console can show delivered / opened / activated.
  // 4. Write an audit row against session.email.
  return NextResponse.json({ ok: true, queued: emails.length, actor: session.email });
}
