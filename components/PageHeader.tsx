import { c, h1 } from '@/lib/theme';

export default function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  // Layout — including the alignment, which flips when this stacks — is in
  // globals.css; an inline value would beat the media query.
  return (
    <header className="page-header" style={{ borderBottom: '0.5px solid #C6CCDA' }}>
      <div>
        <h1 className="page-title" style={h1}>{title}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 16, color: c.muted, fontWeight: 300 }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* The full date is the first thing to go when width is short — it is
            reference, not information anyone came here for. */}
        <span className="hide-sm" style={{ fontSize: 14, color: c.muted }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <span style={{ background: c.blue, color: c.white, padding: '8px 16px', borderRadius: 20, fontSize: 14 }}>Pre-launch</span>
      </div>
    </header>
  );
}
