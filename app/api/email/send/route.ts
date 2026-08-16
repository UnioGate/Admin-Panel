import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { addressOf, replyToAddress } from '@/lib/email';
import { insertOutbound } from '@/lib/email-queries';
import { recordActivity } from '@/lib/queries';
import { canUseMailbox } from '@/lib/data';
import { findMailbox } from '@/lib/mailboxes';
import { resend, resendConfigured } from '@/lib/resend';

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!resendConfigured) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not set — nothing was sent.' }, { status: 503 });
  }

  const body = (await req.json()) as {
    from?: string;
    to?: unknown;
    cc?: unknown;
    subject?: string;
    text?: string;
    threadId?: string;
    inReplyTo?: string | null;
  };

  const from = (body.from ?? '').trim().toLowerCase();
  // Three separate questions, all answered server-side. The client picks a
  // `from` and a client can post anything, so none of this may be inferred from
  // what the UI offered: Resend would happily send as any address on the
  // verified domain if we asked it to.
  const box = await findMailbox(from);
  if (!box) {
    return NextResponse.json({ error: 'Not a configured mailbox: ' + from }, { status: 400 });
  }
  if (box.suspendedAt) {
    return NextResponse.json({ error: from + ' is suspended and cannot send.' }, { status: 403 });
  }
  if (!canUseMailbox(box, session)) {
    return NextResponse.json({ error: from + ' is not one of your mailboxes.' }, { status: 403 });
  }

  const to = normaliseList(body.to);
  const cc = normaliseList(body.cc);
  if (to.length === 0) return NextResponse.json({ error: 'At least one recipient is required.' }, { status: 400 });

  const bad = [...to, ...cc].find(a => !ADDRESS.test(a));
  if (bad) return NextResponse.json({ error: 'Not a valid address: ' + bad }, { status: 400 });

  const subject = (body.subject ?? '').trim();
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'The message body is empty.' }, { status: 400 });

  // A reply keeps its thread; a new message starts one. Either way the id is
  // decided before sending, because it has to go into the Reply-To.
  const threadId = body.threadId ?? randomUUID();

  const { data, error } = await resend.emails.send({
    from,
    to,
    cc: cc.length ? cc : undefined,
    subject: subject || '(no subject)',
    text,
    html: asHtml(text),
    // Replies come back to `mailbox+t<thread>@`, which the catch-all delivers
    // and the webhook decodes — this is what keeps conversations together.
    replyTo: replyToAddress(from, threadId),
    headers: body.inReplyTo
      ? { 'In-Reply-To': body.inReplyTo, References: body.inReplyTo }
      : undefined
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Resend rejected the message.' }, { status: 502 });
  }

  try {
    await insertOutbound({
      threadId,
      mailbox: from,
      to,
      cc,
      subject: subject || '(no subject)',
      text,
      html: null,
      resendId: data.id,
      sentBy: session.email
    });
  } catch (err) {
    // The mail is already gone. Report the storage failure honestly rather than
    // implying nothing happened.
    return NextResponse.json(
      { error: 'Sent, but not recorded: ' + (err as Error).message, threadId, sent: true },
      { status: 502 }
    );
  }

  await recordActivity({
    actor: session.email,
    action: 'Sent email as ' + from,
    target: to.join(', '),
    kind: 'Email'
  });

  return NextResponse.json({ ok: true, threadId, id: data.id });
}

function normaliseList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;]/) : [];
  return raw.map(v => addressOf(String(v))).filter(Boolean);
}

/** Plain text is the source of truth; this is just so HTML clients render breaks. */
function asHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return '<div style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">' + escaped + '</div>';
}
