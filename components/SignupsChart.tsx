'use client';

import { useState } from 'react';
import { c, display } from '@/lib/theme';

export type Day = { label: string; count: number };

export default function SignupsChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState(-1);
  const peak = Math.max(1, ...days.map(d => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 500 }}>Signups, last 14 days</h2>
        <span style={{ fontSize: 14, color: c.muted }}>
          {total} in window · peak {peak} / day
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 190, marginTop: 24 }}>
        {days.map((d, i) => (
          <div
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(-1)}
            style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
          >
            {hover === i ? (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: c.ink, color: c.white, padding: '9px 13px', borderRadius: 10, whiteSpace: 'nowrap', zIndex: 5, pointerEvents: 'none', boxShadow: '0 8px 20px rgba(16,24,42,0.22)' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{d.count} signup{d.count === 1 ? '' : 's'}</div>
                <div style={{ fontSize: 12, color: '#A9B3CC', marginTop: 2 }}>{d.label}</div>
              </div>
            ) : null}
            <div
              style={{
                // Keep a hairline for empty days so the axis reads as a row of
                // days rather than a gap.
                height: d.count === 0 ? 2 : Math.max(4, Math.round((d.count / peak) * 100)) + '%',
                background: hover === i ? c.ink : d.count === 0 ? c.faintBorder : c.blue,
                borderRadius: '6px 6px 0 0'
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: c.soft, marginTop: 10, borderTop: '0.5px solid ' + c.faintBorder, paddingTop: 10 }}>
        <span>{days[0]?.label}</span>
        <span>{days[Math.floor(days.length / 2)]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </>
  );
}
