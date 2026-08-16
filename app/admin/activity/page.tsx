import PageHeader from '@/components/PageHeader';
import { requireAdmin } from '@/lib/auth';
import { fetchActivity } from '@/lib/queries';
import { c, card } from '@/lib/theme';

export default async function ActivityPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const { entries, provisioned } = await fetchActivity();
  const strong = (kind: string) => kind === 'Signup' || kind === 'Inbox';

  return (
    <>
      <PageHeader title="Activity log" subtitle="Everything that happened on the waitlist and in this console" />

      <div style={{ padding: '32px 40px', maxWidth: 900 }}>
        {!provisioned ? (
          <div style={{ ...card, padding: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>The audit table does not exist yet</div>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
              Nothing is being recorded. Run the <code>admin_activity</code> migration from the README in the
              Supabase SQL editor, and actions taken here will start appearing.
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ ...card, padding: 28, fontSize: 15, color: c.muted, fontWeight: 300 }}>
            No activity recorded yet.
          </div>
        ) : (
          <div style={{ ...card, padding: '8px 28px 20px' }}>
            {entries.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '112px 8px 1fr auto', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '0.5px solid ' + c.line }}>
                <span style={{ fontSize: 13, color: c.soft }}>{a.when}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: strong(a.kind) ? c.blue : c.bar }} />
                <span style={{ fontSize: 15, fontWeight: 300 }}>{a.text}</span>
                <span style={{ background: strong(a.kind) ? c.blueTint : c.bg, color: strong(a.kind) ? c.blue : c.muted, padding: '5px 14px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>{a.kind}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: '16px 0 0', fontSize: 14, color: c.muted, fontWeight: 300 }}>
          Actions you take in this console are written to the audit table against your Privy DID.
        </p>
      </div>
    </>
  );
}
