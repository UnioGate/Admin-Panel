import { NextResponse } from 'next/server';
import type { EmailAttachment } from '@/lib/email';
import { findResendId, insertInbound } from '@/lib/email-queries';
import { recordActivity } from '@/lib/queries';
import { resend, resendConfigured, webhookSecret } from '@/lib/resend';

// Every other route in this app sits behind requireAdmin(). This one cannot —
// Resend has no admin session — so the Svix signature is the entire security
// boundary. Without a configured secret we refuse rather than accept anonymous
// writes into the mail store.

export async function POST(req: Request) {
  if (!resendConfigured || !webhookSecret) {
    return NextResponse.json({ error: 'Inbound email is not configured.' }, { status: 503 });
  }

  // Must be the raw body: the signature covers the exact bytes, and parsing
  // then re-stringifying JSON would invalidate it.
  const payload = await req.text();
  const id = req.headers.get('svix-id');
  const timestamp = req.headers.get('svix-timestamp');
  const signature = req.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 });
  }

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // The endpoint is subscribed to email.received, but a misconfigured webhook
  // could send anything. Acknowledge so Resend stops retrying, and ignore it.
  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const emailId = event.data.email_id;

  // Svix retries on any non-2xx, and a retry after a successful insert would
  // duplicate the message. resend_id is unique in the table as a backstop.
  if (await findResendId(emailId)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // The webhook carries metadata only — the body has to be fetched.
  const { data, error } = await resend.emails.receiving.get(emailId);
  if (error || !data) {
    // 502 so Svix retries: the mail exists, we just could not read it yet.
    return NextResponse.json({ error: error?.message ?? 'Could not fetch email' }, { status: 502 });
  }

  const attachments: EmailAttachment[] = (data.attachments ?? []).map(a => ({
    id: a.id,
    filename: a.filename,
    contentType: a.content_type,
    size: a.size,
    inline: a.content_disposition === 'inline'
  }));

  try {
    await insertInbound({
      resendId: emailId,
      from: data.from,
      to: data.to ?? [],
      cc: data.cc ?? [],
      receivedFor: data.received_for ?? [],
      subject: data.subject ?? '',
      html: data.html,
      text: data.text,
      messageId: data.message_id ?? null,
      // Header names arrive in whatever case the sender used.
      inReplyTo: headerValue(data.headers, 'in-reply-to'),
      attachments,
      createdAt: data.created_at
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  await recordActivity({
    actor: data.from,
    action: 'Email received',
    target: data.subject || '(no subject)',
    kind: 'Email'
  });

  return NextResponse.json({ ok: true });
}

function headerValue(headers: Record<string, string> | null, name: string): string | null {
  if (!headers) return null;
  const hit = Object.entries(headers).find(([k]) => k.toLowerCase() === name);
  return hit ? hit[1] : null;
}
