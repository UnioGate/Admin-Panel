'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { MESSAGES } from '@/lib/data';
import { useAdmin } from '@/lib/store';
import { c, display } from '@/lib/theme';
import ConfirmModal from './ConfirmModal';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/activity', label: 'Activity log' },
  { href: '/admin/settings', label: 'Settings' }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = usePrivy();
  const { admins } = useAdmin();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const email = user?.email?.address ?? '';
  const me = admins.find(a => a.email.toLowerCase() === email.toLowerCase());
  const unread = MESSAGES.filter(m => m.unread).length;

  return (
    <aside style={{ background: c.ink, color: c.white, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ padding: '26px 24px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/logo/logo.png" alt="" width={30} height={30} />
        <div>
          <div style={{ fontFamily: display, fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>UnioGate</div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: c.sidebarMuted, marginTop: 3 }}>ADMIN</div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 14px', flex: 1 }}>
        {NAV.map(item => {
          const on = pathname === item.href;
          const badge = item.href === '/admin/messages' && unread ? String(unread) : '';
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                background: on ? c.blue : 'transparent', color: c.white, borderRadius: 20,
                padding: '12px 18px', fontSize: 15, fontWeight: on ? 500 : 300
              }}
            >
              <span>{item.label}</span>
              {badge ? (
                <span style={{ fontSize: 12, background: on ? '#FFFFFF33' : c.sidebarHover, borderRadius: 20, padding: '2px 9px' }}>{badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '20px 24px', borderTop: '0.7px solid #2A3350' }}>
        <div style={{ fontSize: 12, color: c.sidebarMuted }}>Signed in with Privy</div>
        <div style={{ fontSize: 15, marginTop: 4, fontWeight: 500 }}>{me?.name ?? email.split('@')[0] ?? 'Admin'}</div>
        <div style={{ fontSize: 12, color: c.sidebarMuted, marginTop: 2, overflowWrap: 'anywhere' }}>
          {email} · {me?.role ?? 'Admin'}
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          style={{ marginTop: 12, background: 'transparent', color: c.white, border: '0.7px solid ' + c.sidebarBorder, borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>

      {confirm ? (
        <ConfirmModal
          title="Sign out of the console?"
          body="You’ll need to re-authenticate with Privy to get back in. Nothing in progress is saved."
          cta="Sign out"
          ctaColor={c.ink}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => { await logout(); router.replace('/login'); }}
        />
      ) : null}
    </aside>
  );
}
