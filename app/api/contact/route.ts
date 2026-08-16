import { NextResponse } from 'next/server';

// Public endpoint — the marketing site's contact form posts here.
export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    business?: string;
    topic?: string;
    message?: string;
  };

  if (!body.email || !body.message) {
    return NextResponse.json({ error: 'email and message are required' }, { status: 400 });
  }

  // TODO: insert into contact_messages, then notify #enquiries.
  return NextResponse.json({ ok: true });
}
