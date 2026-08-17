import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchActivity, recordActivity } from '@/lib/queries';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // `provisioned: false` means the admin_activity table has not been created
    // yet — the console says so rather than pretending the log is empty.
    return NextResponse.json(await fetchActivity(session));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, target, kind } = (await req.json()) as {
    action: string;
    target?: string | null;
    kind?: string;
  };
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  const logged = await recordActivity({ actor: session.email, action, target, kind });
  return NextResponse.json({ ok: true, logged });
}
