'use client';

import { useAdmin } from '@/lib/store';
import { c } from '@/lib/theme';

export default function Toast() {
  const { toast } = useAdmin();
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', right: 28, bottom: 28, zIndex: 50, background: c.ink, color: c.white, borderRadius: 10, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 16px 40px rgba(16,24,42,0.3)', maxWidth: 420 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7E96E0', flex: 'none' }} />
      <span style={{ fontSize: 15, fontWeight: 300 }}>{toast}</span>
    </div>
  );
}
