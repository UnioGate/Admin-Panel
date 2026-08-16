import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import { listAdmins } from '@/lib/admins';
import { requireAdmin } from '@/lib/auth';
import { canUseMailbox } from '@/lib/data';
import { unreadEmailCount } from '@/lib/email-queries';
import { listMailboxes } from '@/lib/mailboxes';
import { fetchMessages } from '@/lib/queries';
import { AdminProvider } from '@/lib/store';

// The badges are decoration — a Supabase hiccup should not take down the shell.
async function unreadCount() {
  try {
    const messages = await fetchMessages();
    return messages.filter(m => m.status === 'new').length;
  } catch {
    return 0;
  }
}

async function unreadEmail() {
  try {
    return await unreadEmailCount();
  } catch {
    return 0;
  }
}

// Whether the table exists is worth knowing even for a request we are about to
// turn away: "run the migration" and "you are not on the list" need different
// messages, and only one of them is the user's fault.
async function allowlist() {
  try {
    return await listAdmins();
  } catch {
    return { admins: [], provisioned: true };
  }
}

// Same reasoning, and the same distinction between "no table" and "no rows".
async function domainMailboxes() {
  try {
    return await listMailboxes();
  } catch {
    return { mailboxes: [], provisioned: true };
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // AuthGuard is the client-side experience; this is the server-side gate, so
  // no admin data is fetched or rendered for a request that is not allowlisted.
  const session = await requireAdmin();
  const [{ admins, provisioned }, { mailboxes, provisioned: mailboxesProvisioned }] = await Promise.all([
    allowlist(),
    domainMailboxes()
  ]);
  const [unread, emails] = session ? await Promise.all([unreadCount(), unreadEmail()]) : [0, 0];

  return (
    <AdminProvider
      session={session && { email: session.email, name: session.name, role: session.role }}
      // The lists only go to the browser for someone already through the gate.
      // A rejected request gets the empty arrays.
      admins={session ? admins : []}
      adminsProvisioned={provisioned}
      // Who owns which address is Owner business. Scoped on the server for the
      // same reason as the email page: filtering in the browser would still
      // have shipped the whole list.
      mailboxes={session ? mailboxes.filter(m => canUseMailbox(m, session)) : []}
      mailboxesProvisioned={mailboxesProvisioned}
    >
      <AuthGuard>
        {/* Grid columns and the sidebar's off-canvas behaviour live in
            globals.css — a media query cannot be expressed inline. */}
        <div className="shell">
          <Sidebar unread={unread} unreadEmail={emails} />
          <main className="shell-main">{session ? children : null}</main>
          <Toast />
        </div>
      </AuthGuard>
    </AdminProvider>
  );
}
