'use client';

import { useState } from 'react';
import { c, display, input } from '@/lib/theme';

export default function InviteModal({
  base, scoped, onClose, onSend
}: {
  base: string[];
  scoped: boolean;
  onClose: () => void;
  onSend: (emails: string[]) => void;
}) {
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const list = [...base.filter(e => !off[e]), ...extra];

  const add = () => {
    const v = draft.trim().replace(/,$/, '');
    if (v.indexOf('@') < 1) return;
    setExtra(x => (x.includes(v) ? x : [...x, v]));
    setDraft('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,42,0.55)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="modal-card" style={{ background: c.white, borderRadius: 10, width: '100%', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(16,24,42,0.28)' }}>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 500 }}>Send invites</h2>
        <p style={{ margin: '10px 0 24px', fontSize: 16, color: c.muted, fontWeight: 300, lineHeight: 1.6 }}>
          {scoped
            ? 'These are the records you selected — tap to deselect any. Add addresses that aren’t on the waitlist, pressing Enter after each.'
            : 'Pending signups are selected by default — tap to deselect. Add any address that isn’t on the waitlist, pressing Enter after each.'}
        </p>

        <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
          {scoped ? 'Selected records' : 'Pending on the waitlist'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {base.map(email => {
            const on = !off[email];
            return (
              <button
                key={email}
                type="button"
                onClick={() => setOff(o => ({ ...o, [email]: !o[email] }))}
                style={{ padding: '9px 16px', borderRadius: 20, fontSize: 14, cursor: 'pointer', border: '0.7px solid ' + c.border, background: on ? c.blue : 'transparent', color: on ? c.white : c.ink, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>{on ? '✓' : '+'}</span><span>{email}</span>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '26px 0 12px' }}>Add addresses</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
            placeholder="merchant@example.com"
            style={{ ...input, flex: 1 }}
          />
          <button type="button" onClick={add} style={{ background: c.white, color: c.blue, border: '0.7px solid ' + c.blue, padding: '13px 22px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Add</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          {extra.map(email => (
            <span key={email} style={{ display: 'flex', alignItems: 'center', gap: 10, background: c.blueTint, color: c.blue, padding: '8px 10px 8px 16px', borderRadius: 20, fontSize: 14 }}>
              <span>{email}</span>
              <button type="button" onClick={() => setExtra(x => x.filter(v => v !== email))} style={{ background: c.blue, color: c.white, border: 0, width: 20, height: 20, borderRadius: '50%', fontSize: 13, lineHeight: 1, cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 30, paddingTop: 22, borderTop: '0.5px solid ' + c.line }}>
          <button type="button" onClick={() => onSend(list)} style={{ background: c.blue, color: c.white, border: 0, padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Send {list.length} invite{list.length === 1 ? '' : 's'}
          </button>
          <button type="button" onClick={onClose} style={{ background: c.white, color: c.ink, border: '0.7px solid ' + c.border, padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <span style={{ fontSize: 14, color: c.soft, fontWeight: 300 }}>Sends from hello@uniogate.com · 7-day activation link</span>
        </div>
      </div>
    </div>
  );
}
