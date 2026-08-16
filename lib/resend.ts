import { Resend } from 'resend';

// Server-only. The API key can send mail as any address on the verified
// domain, so it must never reach the browser.
if (typeof window !== 'undefined') {
  throw new Error('lib/resend.ts is server-only and must not be imported into a client component.');
}

const apiKey = process.env.RESEND_API_KEY;

export const resendConfigured = !!apiKey;
export const webhookSecret = process.env.RESEND_WEBHOOK_SECRET ?? '';

// Constructing with a placeholder keeps imports cheap; every caller checks
// `resendConfigured` first and reports the missing key rather than throwing a
// stack trace at whoever opened the page.
export const resend = new Resend(apiKey ?? 're_not_configured');

export const EMAIL_DOMAIN = (process.env.EMAIL_DOMAIN ?? 'uniogate.com').toLowerCase();

/**
 * Addresses the console may send as. Resend has no per-address setup — a
 * verified domain permits any local part — so this list exists to stop a typo
 * going out as a real-looking address nobody reads, not because Resend needs it.
 */
export const MAILBOXES: string[] = (process.env.EMAIL_MAILBOXES ?? 'support,hello,partners')
  .split(',')
  .map(part => part.trim().toLowerCase())
  .filter(Boolean)
  .map(local => (local.includes('@') ? local : local + '@' + EMAIL_DOMAIN));

export function isKnownMailbox(address: string): boolean {
  return MAILBOXES.includes(address.trim().toLowerCase());
}
