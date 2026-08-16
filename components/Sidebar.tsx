'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAdmin } from '@/lib/store';
import { c, display } from '@/lib/theme';
import ConfirmModal from './ConfirmModal';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/email', label: 'Email' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/activity', label: 'Activity log' },
  { href: '/admin/settings', label: 'Settings' }
];

export default function Sidebar({ unread, unreadEmail }: { unread: number; unreadEmail: number }) {
  const pathname = usePathname();
  const { user, logout } = usePrivy();
  // Name and role come from the session the server resolved, not from a lookup
  // in a client-side copy of the list — there is no client-side copy any more.
  const { session } = useAdmin();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  // Only has an effect below 1024px, where the aside is an off-canvas drawer.
  // Above that the CSS ignores it and the sidebar is simply a grid column.
  const [open, setOpen] = useState(false);

  const email = session?.email ?? user?.email?.address ?? '';
  const badgeFor = (href: string) => (href === '/admin/messages' ? unread : href === '/admin/email' ? unreadEmail : 0);

  // A drawer sliding over the page while the page keeps scrolling underneath
  // reads as broken. Only lock while it is actually open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const current = NAV.find(item => item.href === pathname);
  const totalBadge = unread + unreadEmail;

  return (
    <>
      {/* Hidden above 1024px. Rendered before <main> so it takes the first
          grid row once the sidebar drops out of flow. */}
      <header className="topbar">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Open navigation"
          aria-expanded={open}
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, width: 38, height: 38, borderRadius: '50%', background: 'transparent', border: '0.7px solid ' + c.sidebarBorder, cursor: 'pointer', padding: 0, flexShrink: 0 }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{ display: 'block', width: 16, height: 1.5, background: c.white, margin: '0 auto' }} />
          ))}
        </button>

        <span style={{ fontFamily: display, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {current?.label ?? 'UnioGate'}
        </span>

        {totalBadge ? (
          <span style={{ marginLeft: 'auto', fontSize: 12, background: c.blue, borderRadius: 20, padding: '3px 10px' }}>
            {totalBadge}
          </span>
        ) : null}
      </header>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className="sidebar" data-open={open} style={{ background: c.ink, color: c.white }}>
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
            const count = badgeFor(item.href);
            const badge = count ? String(count) : '';
            return (
              <Link
                key={item.href}
                href={item.href}
                // Navigating does not unmount the drawer, so it would otherwise
                // stay open over the page you just asked for.
                onClick={() => setOpen(false)}
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
          <div style={{ fontSize: 15, marginTop: 4, fontWeight: 500 }}>{session?.name || email.split('@')[0] || 'Admin'}</div>
          <div style={{ fontSize: 12, color: c.sidebarMuted, marginTop: 2, overflowWrap: 'anywhere' }}>
            {email}{session ? ' · ' + session.role : ''}
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
    </>
  );
}
