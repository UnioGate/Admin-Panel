import PageHeader from '@/components/PageHeader';
import SignupsChart, { type Day } from '@/components/SignupsChart';
import { requireAdmin } from '@/lib/auth';
import type { WaitlistEntry } from '@/lib/data';
import { shortDate } from '@/lib/format';
import { fetchActivity, fetchMessages, fetchWaitlist } from '@/lib/queries';
import { c, card, display } from '@/lib/theme';

function last14Days(entries: WaitlistEntry[]): Day[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days: Day[] = [];

  for (let i = 13; i >= 0; i--) {
    const from = new Date(start);
    from.setDate(start.getDate() - i);
    const to = new Date(from);
    to.setDate(from.getDate() + 1);
    days.push({
      label: shortDate(from.toISOString()),
      count: entries.filter(e => {
        const t = new Date(e.createdAt);
        return t >= from && t < to;
      }).length
    });
  }
  return days;
}

export default async function OverviewPage() {
  const session = await requireAdmin();
  if (!session) return null;

  const [waitlist, messages, activity] = await Promise.all([
    fetchWaitlist(),
    fetchMessages(),
    fetchActivity(7)
  ]);

  const visible = waitlist.filter(e => e.hiddenAt === null);
  const days = last14Days(visible);
  const newEnquiries = messages.filter(m => m.status === 'new').length;

  const stats = [
    { label: 'Total signups', value: visible.length, note: days.reduce((n, d) => n + d.count, 0) + ' in the last 14 days', accent: true },
    { label: 'Subscribed', value: visible.filter(e => !e.unsubscribed).length, note: visible.filter(e => e.unsubscribed).length + ' unsubscribed', accent: false },
    { label: 'Enquiries', value: messages.length, note: newEnquiries + ' unread', accent: true },
    { label: 'Hidden records', value: waitlist.length - visible.length, note: 'Excluded from exports', accent: false }
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Waitlist growth and merchant enquiries at a glance" />

      <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="stat-grid">
          {stats.map(s => (
            <div key={s.label} style={{ ...card, padding: 24 }}>
              <div style={{ fontSize: 14, color: c.muted }}>{s.label}</div>
              <div style={{ fontFamily: display, fontSize: 42, fontWeight: 500, lineHeight: 1.1, marginTop: 6 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: s.accent ? c.blue : c.muted, marginTop: 6 }}>{s.note}</div>
            </div>
          ))}
        </div>

        <div className="split-main">
          <div style={card}>
            <SignupsChart days={days} />
          </div>

          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Recent activity</h2>
            {!activity.provisioned ? (
              <p style={{ margin: '10px 0 0', fontSize: 14, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
                No audit table yet — run the <code>admin_activity</code> migration from the README to start
                recording what happens in the console.
              </p>
            ) : activity.entries.length === 0 ? (
              <p style={{ margin: '10px 0 0', fontSize: 14, color: c.muted, fontWeight: 300 }}>Nothing recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activity.entries.map((a, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '8px 1fr', gap: 14, padding: '14px 0', borderBottom: '0.5px solid ' + c.line }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.kind === 'Signup' || a.kind === 'Inbox' ? c.blue : c.bar, marginTop: 7 }} />
                    <div>
                      <div style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 300 }}>{a.text}</div>
                      <div style={{ fontSize: 13, color: c.soft, marginTop: 3 }}>{a.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
