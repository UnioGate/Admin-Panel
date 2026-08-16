import EmailConsole from '@/components/EmailConsole';
import { requireAdmin } from '@/lib/auth';
import { fetchThreads } from '@/lib/email-queries';
import { MAILBOXES, resendConfigured } from '@/lib/resend';

export default async function EmailPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const { threads, provisioned } = await fetchThreads();

  return (
    <EmailConsole
      threads={threads}
      mailboxes={MAILBOXES}
      provisioned={provisioned}
      configured={resendConfigured}
      canDelete={session.role === 'Owner'}
    />
  );
}
