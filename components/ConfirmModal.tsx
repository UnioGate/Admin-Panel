'use client';

import { c, display } from '@/lib/theme';

export default function ConfirmModal({
  title, body, cta, ctaColor = c.blue, onConfirm, onCancel
}: {
  title: string;
  body: string;
  cta: string;
  ctaColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,42,0.55)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.white, borderRadius: 10, padding: 36, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(16,24,42,0.28)' }}>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 500, lineHeight: '120%' }}>{title}</h2>
        <p style={{ margin: '12px 0 28px', fontSize: 16, lineHeight: 1.65, color: c.muted, fontWeight: 300 }}>{body}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={onConfirm} style={{ background: ctaColor, color: c.white, border: 0, padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{cta}</button>
          <button type="button" onClick={onCancel} style={{ background: c.white, color: c.ink, border: '0.7px solid ' + c.border, padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
