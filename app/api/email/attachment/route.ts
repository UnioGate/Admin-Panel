import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { resend, resendConfigured } from '@/lib/resend';

/**
 * Resend hands out short-lived signed download URLs. Proxying them keeps those
 * URLs off the page — a signed link in the HTML would still work after the
 * admin signed out, and would be shareable by anyone who saw it.
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
