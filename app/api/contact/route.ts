import { NextResponse } from 'next/server';
import { insertContactMessage } from '@/lib/queries';

// Public endpoint — the marketing site's contact form posts here.
export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    business?: string;
    topic?: string;
    volume?: string;
    message?: string;
  };

  if (!body.email || !body.message) {
    return NextResponse.json({ error: 'email and message are required' }, { status: 400 });
  }

  try {
    await insertContactMessage({
      name: body.name?.trim() || body.email,
      email: body.email.trim().toLowerCase(),
      message: body.message,
      topic: body.topic ?? null,
      business: body.business ?? null,
      volume: body.volume ?? null
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  // TODO: notify #enquiries once a webhook exists.
  return NextResponse.json({ ok: true });
}
