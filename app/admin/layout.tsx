import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import { AdminProvider } from '@/lib/store';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AuthGuard>
        <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', minHeight: '100vh', background: '#E9ECF3' }}>
          <Sidebar />
          <main style={{ minWidth: 0 }}>{children}</main>
          <Toast />
        </div>
      </AuthGuard>
    </AdminProvider>
  );
}
