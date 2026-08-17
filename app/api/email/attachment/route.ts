import { NextResponse } from 'next/server';
import { downloadStoredAttachment } from '@/lib/attachments';
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

  const url = new URL(req.url);
  const emailId = url.searchParams.get('email');
  const attachmentId = url.searchParams.get('id');
  if (!emailId || !attachmentId) {
    return NextResponse.json({ error: 'email and id are required' }, { status: 400 });
  }

  const message = await readableMessageByResendId(emailId, session);
  const attachment = message?.attachments.find(a => a.id === attachmentId);
  // One message for both misses. Distinguishing "not yours" from "no such
  // message" would confirm which ids exist.
  if (!message || !attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  // A file we sent lives in our own bucket; a file we received lives at Resend.
  // Same URL either way, because the difference is not the reader's problem.
  const source = attachment.path
    ? await fromStorage(attachment.path)
    : await fromResend(emailId, attachmentId);

  if ('error' in source) {
    return NextResponse.json({ error: source.error }, { status: source.status });
  }

  return new NextResponse(source.body, {
    headers: {
      'content-type': source.contentType,
      // Always an attachment: rendering an untrusted file inline would run it
      // on this origin, alongside the admin session.
      'content-disposition':
        'attachment; filename="' +
        (attachment.filename ?? source.filename ?? 'attachment').replace(/["\r\n]/g, '') +
        '"',
      'cache-control': 'private, no-store'
    }
  });
}

type Source =
  | { body: ReadableStream<Uint8Array>; contentType: string; filename: string | null }
  | { error: string; status: number };

async function fromStorage(path: string): Promise<Source> {
  const blob = await downloadStoredAttachment(path);
  if (!blob) return { error: 'Could not read the stored attachment.', status: 502 };
  return {
    body: blob.stream() as ReadableStream<Uint8Array>,
    contentType: blob.type || 'application/octet-stream',
    filename: null
  };
}

async function fromResend(emailId: string, attachmentId: string): Promise<Source> {
  // Only inbound needs the key. A file we sent comes out of our own bucket, and
  // refusing it because Resend is unconfigured would withhold something we hold.
  if (!resendConfigured) return { error: 'RESEND_API_KEY is not set.', status: 503 };

  const { data, error } = await resend.emails.receiving.attachments.get({ emailId, id: attachmentId });
  if (error || !data) {
    return { error: error?.message ?? 'Attachment not found', status: 502 };
  }

  // Resend hands out a short-lived signed URL rather than the bytes.
  const file = await fetch(data.download_url);
  if (!file.ok || !file.body) {
    return { error: 'Could not download the attachment.', status: 502 };
  }

  return { body: file.body, contentType: data.content_type, filename: data.filename ?? null };
}
