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

/**
 * The domain Resend has verified. Every mailbox must be on it — Resend permits
 * any local part on a verified domain and none at all anywhere else — so this
 * is what `lib/mailboxes.ts` validates new addresses against.
 *
 * The addresses themselves used to live in EMAIL_MAILBOXES and now live in the
 * `mailboxes` table, so they can be created and assigned without a redeploy.
 */
export const EMAIL_DOMAIN = (process.env.EMAIL_DOMAIN ?? 'uniogate.com').toLowerCase();
