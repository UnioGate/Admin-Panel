import { randomUUID } from 'crypto';
import { supabase } from './supabase';
import {
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  type EmailAttachment
} from './email';

/**
 * Where the bytes of files *we* send are kept.
 *
 * Inbound attachments are not copied here: Resend already holds them and serves
 * them by id, so a second copy would be one more thing to keep in sync. Outbound
 * has no such source — Resend's attachment API only answers for mail it
 * received — so without this bucket a sent file would be gone the moment the
 * request finished, and the Sent folder would list attachments nobody could open.
 *
 * The bucket is private. Nothing is ever served from it directly; downloads go
 * through /api/email/attachment, which checks the message belongs to the viewer
 * first. A public bucket would make every object readable by URL alone, which is
 * the whole of the protection gone.
 */
export const ATTACHMENT_BUCKET = 'email-attachments';

/**
 * Strips directory separators and anything else that would let a filename
 * escape its prefix or confuse the download header. The original name is kept
 * in the database for display — this only sanitises the object key.
 */
function safeName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? 'file')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120) || 'file';
}

export type OutboundFile = { filename: string; contentType: string; bytes: Buffer };

/** Rejects the whole set rather than silently dropping one, which would send a message the author thought had five files and it had four. */
export function checkAttachmentSizes(files: OutboundFile[]): string | null {
  const tooBig = files.find(f => f.bytes.length > MAX_ATTACHMENT_BYTES);
  if (tooBig) {
    return tooBig.filename + ' is ' + formatBytes(tooBig.bytes.length) +
      ' — the limit is ' + formatBytes(MAX_ATTACHMENT_BYTES) + ' per file.';
  }

  const total = files.reduce((n, f) => n + f.bytes.length, 0);
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    return 'Those files come to ' + formatBytes(total) +
      ' — the limit is ' + formatBytes(MAX_TOTAL_ATTACHMENT_BYTES) + ' per message.';
  }

  return null;
}

/**
 * Uploads the files and returns the metadata to store on the message.
 *
 * Keyed by thread so a deleted conversation's objects can be found again
 * without consulting the row that is about to disappear.
 */
export async function storeOutboundAttachments(
  threadId: string,
  files: OutboundFile[]
): Promise<EmailAttachment[]> {
  const stored: EmailAttachment[] = [];

  for (const file of files) {
    const id = randomUUID();
    const path = threadId + '/' + id + '-' + safeName(file.filename);

    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file.bytes, { contentType: file.contentType, upsert: false });

    if (error) throw new Error('attachment ' + file.filename + ': ' + error.message);

    stored.push({
      id,
      filename: file.filename,
      contentType: file.contentType,
      size: file.bytes.length,
      inline: false,
      path
    });
  }

  return stored;
}

/** Unwinds an upload whose message never went out. */
export async function removeStoredAttachments(attachments: EmailAttachment[]): Promise<void> {
  const paths = attachments.map(a => a.path).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
}

export async function downloadStoredAttachment(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

/**
 * Deletes everything stored under a thread. Called when a conversation is
 * deleted — the rows go and the objects would otherwise stay, paid for and
 * unreachable, with no row left pointing at them.
 *
 * Best effort on purpose: the conversation is already gone from the console by
 * the time this runs, and failing the delete over an orphaned object would
 * leave the user with a thread they asked to remove.
 */
export async function removeThreadAttachments(threadId: string): Promise<void> {
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).list(threadId);
  if (error || !data || data.length === 0) return;
  await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove(data.map(o => threadId + '/' + o.name));
}
