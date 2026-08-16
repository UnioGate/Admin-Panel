import EmailConsole from '@/components/EmailConsole';
import { requireAdmin } from '@/lib/auth';
import { canUseMailbox } from '@/lib/data';
import { fetchThreads } from '@/lib/email-queries';
import { listMailboxes } from '@/lib/mailboxes';
import { resendConfigured } from '@/lib/resend';

export default async function EmailPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const [{ threads, provisioned }, { mailboxes, provisioned: mailboxesProvisioned }] = await Promise.all([
    fetchThreads(),
    listMailboxes()
  ]);

  // Scoped here, on the server, rather than in the console: filtering in the
  // browser would still have shipped the full list of who owns what.
  const mine = mailboxes.filter(m => canUseMailbox(m, session));

  return (
    <EmailConsole
      threads={threads}
      // Only addresses that can actually send are offered as a `from`. A
      // suspended one still appears in the mailbox filter below, because its
      // old mail is still there to read.
      mailboxes={mine.filter(m => !m.suspendedAt).map(m => m.address)}
      readableMailboxes={mine.map(m => m.address)}
      mailboxesProvisioned={mailboxesProvisioned}
      provisioned={provisioned}
      configured={resendConfigured}
      canDelete={session.role === 'Owner'}
    />
  );
}
