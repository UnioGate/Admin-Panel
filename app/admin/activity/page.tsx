'use client';

import PageHeader from '@/components/PageHeader';
import { useAdmin } from '@/lib/store';
import { c, card } from '@/lib/theme';

export default function ActivityPage() {
  const { activity } = useAdmin();
  const strong = (kind: string) => kind === 'Signup' || kind === 'Inbox';

  return (
    <>
      <PageHeader title="Activity log" subtitle="Everything that happened on the waitlist and in this console" />

      <div style={{ padding: '32px 40px', maxWidth: 900 }}>
        <div style={{ ...card, padding: '8px 28px 20px' }}>
          {activity.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '112px 8px 1fr auto', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '0.5px solid ' + c.line }}>
              <span style={{ fontSize: 13, color: c.soft }}>{a.when}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: strong(a.kind) ? c.blue : c.bar }} />
              <span style={{ fontSize: 15, fontWeight: 300 }}>{a.text}</span>
              <span style={{ background: strong(a.kind) ? c.blueTint : c.bg, color: strong(a.kind) ? c.blue : c.muted, padding: '5px 14px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>{a.kind}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 14, color: c.muted, fontWeight: 300 }}>
          Actions you take in this console are appended here and written to the audit table against your Privy DID.
        </p>
      </div>
    </>
  );
}
