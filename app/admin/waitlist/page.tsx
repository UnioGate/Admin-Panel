import WaitlistTable from '@/components/WaitlistTable';
import { requireAdmin } from '@/lib/auth';
import { fetchWaitlist } from '@/lib/queries';

export default async function WaitlistPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const entries = await fetchWaitlist();
  return <WaitlistTable entries={entries} />;
}
