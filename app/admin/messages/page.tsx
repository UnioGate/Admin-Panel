import MessageInbox from '@/components/MessageInbox';
import { requireAdmin } from '@/lib/auth';
import { fetchMessages } from '@/lib/queries';

export default async function MessagesPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const messages = await fetchMessages();
  return <MessageInbox messages={messages} />;
}
