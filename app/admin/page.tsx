'use client';

import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { MESSAGES, SIGNUPS_14D, SOURCES } from '@/lib/data';
import { useAdmin } from '@/lib/store';
import { c, card, display } from '@/lib/theme';

const STATS = [
  { label: 'Total signups', value: '2,481', delta: '+214 this week', accent: true },
  { label: 'Confirmed', value: '1,903', delta: '76.7% confirm rate', accent: false },
  { label: 'Enquiries', value: '63', delta: '', accent: true },
  { label: 'Invites sent', value: '120', delta: '48 activated', accent: false }
];

export default function OverviewPage() {
  const { activity } = useAdmin();
  const [hover, setHover] = useState(-1);
  const unread = MESSAGES.filter(m => m.unread).length;
  const peak = Math.max(...SIGNUPS_14D);

  return (
    <>
      <PageHeader title="Overview" subtitle="Waitlist growth and merchant enquiries at a glance" />

      <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ ...card, padding: 24 }}>
              <div style={{ fontSize: 14, color: c.muted }}>{s.label}</div>
              <div style={{ fontFamily: display, fontSize: 42, fontWeight: 500, lineHeight: 1.1, marginTop: 6 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: s.accent ? c.blue : c.muted, marginTop: 6 }}>
                {s.label === 'Enquiries' ? unread + ' unread' : s.delta}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 500 }}>Signups, last 14 days</h2>
              <span style={{ fontSize: 14, color: c.muted }}>peak {peak} / day</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 190, marginTop: 24 }}>
              {SIGNUPS_14D.map((v, i) => {
                const prev = SIGNUPS_14D[i - 1];
                const pct = prev ? Math.round(((v - prev) / prev) * 100) : 0;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(-1)}
                    style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
                  >
                    {hover === i ? (
                      <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: c.ink, color: c.white, padding: '9px 13px', borderRadius: 10, whiteSpace: 'nowrap', zIndex: 5, pointerEvents: 'none', boxShadow: '0 8px 20px rgba(16,24,42,0.22)' }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{v} signups</div>
                        <div style={{ fontSize: 12, color: '#A9B3CC', marginTop: 2 }}>
                          Aug {i + 2} · {prev ? (pct >= 0 ? '+' : '') + pct + '% vs prev day' : 'first day of window'}
                        </div>
                      </div>
                    ) : null}
                    <div style={{ height: Math.round((v / peak) * 100) + '%', background: hover === i ? c.ink : i >= SIGNUPS_14D.length - 3 ? c.blue : c.bar, borderRadius: '6px 6px 0 0' }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: c.soft, marginTop: 10, borderTop: '0.5px solid ' + c.faintBorder, paddingTop: 10 }}>
              <span>Aug 2</span><span>Aug 9</span><span>Aug 15</span>
            </div>

            <h2 style={{ margin: '32px 0 16px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Where they come from</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SOURCES.map(s => (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 56px', alignItems: 'center', gap: 16, fontSize: 15 }}>
                  <span>{s.name}</span>
                  <span style={{ height: 10, background: c.bg, borderRadius: 20, display: 'block', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: 10, width: Math.round((s.count / SOURCES[0].count) * 100) + '%', background: c.blue, borderRadius: 20 }} />
                  </span>
                  <span style={{ textAlign: 'right', color: c.muted }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontFamily: display, fontSize: 22, fontWeight: 500 }}>Recent activity</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activity.slice(0, 7).map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '8px 1fr', gap: 14, padding: '14px 0', borderBottom: '0.5px solid ' + c.line }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.kind === 'Signup' || a.kind === 'Inbox' ? c.blue : c.bar, marginTop: 7 }} />
                  <div>
                    <div style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 300 }}>{a.text}</div>
                    <div style={{ fontSize: 13, color: c.soft, marginTop: 3 }}>{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
