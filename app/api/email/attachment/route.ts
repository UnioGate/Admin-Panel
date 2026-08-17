import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readableMessageByResendId } from '@/lib/email-queries';
import { resend, resendConfigured } from '@/lib/resend';

/**
 * Resend hands out short-lived signed download URLs. Proxying them keeps those
 * URLs off the page — a signed link in the HTML would still work after the
 * admin signed out, and would be shareable by anyone who saw it.
 *
 * Both ids are checked against our own table first. Handing them straight to
 * Resend would have served an attachment from any message on the account —
 * another admin's mailbox, or mail that never went through this console.
 */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!resendConfigured) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not set.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const emailId = url.searchParams.get('email');
  const attachmentId = url.searchParams.get('id');
  if (!emailId || !attachmentId) {
    return NextResponse.json({ error: 'email and id are required' }, { status: 400 });
  }

  const message = await readableMessageByResendId(emailId, session);
  // One message for both misses. Distinguishing "not yours" from "no such
  // message" would confirm which ids exist.
  if (!message || !message.attachments.some(a => a.id === attachmentId)) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const { data, error } = await resend.emails.receiving.attachments.get({ emailId, id: attachmentId });
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Attachment not found' }, { status: 502 });
  }

  const file = await fetch(data.download_url);
  if (!file.ok || !file.body) {
    return NextResponse.json({ error: 'Could not download the attachment.' }, { status: 502 });
  }

  return new NextResponse(file.body, {
    headers: {
      'content-type': data.content_type,
      // Always an attachment: rendering an untrusted file inline would run it
      // on this origin, alongside the admin session.
      'content-disposition':
        'attachment; filename="' + (data.filename ?? 'attachment').replace(/"/g, '') + '"',
      'cache-control': 'private, no-store'
    }
  });
}
