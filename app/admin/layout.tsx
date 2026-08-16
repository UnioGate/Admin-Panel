import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import { requireAdmin } from '@/lib/auth';
import { fetchMessages } from '@/lib/queries';
import { AdminProvider } from '@/lib/store';

async function unreadCount() {
  // The badge is decoration — a Supabase hiccup should not take down the shell.
  try {
    const messages = await fetchMessages();
    return messages.filter(m => m.status === 'new').length;
  } catch {
    return 0;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // AuthGuard is the client-side experience; this is the server-side gate, so
  // no admin data is fetched or rendered for a request that is not allowlisted.
  const session = await requireAdmin();
  const unread = session ? await unreadCount() : 0;

  return (
    <AdminProvider>
      <AuthGuard>
        <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', minHeight: '100vh', background: '#E9ECF3' }}>
          <Sidebar unread={unread} />
          <main style={{ minWidth: 0 }}>{session ? children : null}</main>
          <Toast />
        </div>
      </AuthGuard>
    </AdminProvider>
  );
}
