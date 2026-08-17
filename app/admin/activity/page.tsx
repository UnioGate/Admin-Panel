import PageHeader from '@/components/PageHeader';
import { requireAdmin } from '@/lib/auth';
import { fetchActivity } from '@/lib/queries';
import { c, card } from '@/lib/theme';

export default async function ActivityPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const { entries, provisioned } = await fetchActivity(session);
  const strong = (kind: string) => kind === 'Signup' || kind === 'Inbox';

  return (
    <>
      <PageHeader title="Activity log" subtitle="Everything that happened on the waitlist and in this console" />

      <div className="page-pad" style={{ maxWidth: 900 }}>
        {!provisioned ? (
          <div style={{ ...card, padding: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>The audit table does not exist yet</div>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
              Nothing is being recorded. Run <code>sql/activity.sql</code> in the Supabase SQL editor,
              and actions taken here will start appearing.
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ ...card, padding: 28, fontSize: 15, color: c.muted, fontWeight: 300 }}>
            No activity recorded yet.
          </div>
        ) : (
          <div style={{ ...card, padding: '8px 28px 20px' }}>
            {/* Four columns on desktop; on mobile the timestamp and kind drop to
                a second line under the text. Grid areas rather than reordered
                markup, so the reading order stays the same. */}
            {entries.map((a, i) => (
              <div key={i} className="activity-row" style={{ padding: '16px 0', borderBottom: '0.5px solid ' + c.line }}>
                <span className="activity-when" style={{ fontSize: 13, color: c.soft }}>{a.when}</span>
                <span className="activity-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: strong(a.kind) ? c.blue : c.bar }} />
                <span className="activity-text" style={{ fontSize: 15, fontWeight: 300 }}>
                  {a.text}
                  {/* Who did it. Second line rather than inline: the action is
                      what you scan for, the actor is what you check after. */}
                  <span style={{ display: 'block', fontSize: 13, color: c.soft, marginTop: 3 }}>{a.actor}</span>
                </span>
                <span className="activity-kind" style={{ background: strong(a.kind) ? c.blueTint : c.bg, color: strong(a.kind) ? c.blue : c.muted, padding: '5px 14px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap' }}>{a.kind}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ margin: '16px 0 0', fontSize: 14, color: c.muted, fontWeight: 300 }}>
          Every action in this console is recorded against the admin who took it. Entries about a
          mailbox you do not hold are not shown here — an Owner sees the whole log.
        </p>
      </div>
    </>
  );
}
