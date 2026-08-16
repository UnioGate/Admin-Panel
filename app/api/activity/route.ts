import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { BASE_ACTIVITY } from '@/lib/data';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // TODO: select * from admin_activity order by created_at desc limit 200;
  return NextResponse.json({ entries: BASE_ACTIVITY });
}
