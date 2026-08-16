'use client';

import { useEffect, useState } from 'react';
import { WAITLIST, type WaitlistEntry } from '@/lib/data';
import { useAdmin } from '@/lib/store';
import { btnPrimary, btnSecondary, c, display, input, statusChip } from '@/lib/theme';

export default function RecordDrawer({
  record, onClose, onInvite
}: {
  record: WaitlistEntry;
  onClose: () => void;
  onInvite: (email: string) => void;
}) {
  const { notes, saveNote, hidden, hide, restore } = useAdmin();
  const [draft, setDraft] = useState(notes[record.email] ?? '');

  useEffect(() => { setDraft(notes[record.email] ?? ''); }, [record.email, notes]);

  const isHidden = !!hidden[record.email];
  const events = [
    { label: 'Joined the waitlist', when: record.joined, strong: true },
    { label: 'Confirmation email delivered', when: record.joined, strong: false },
    record.status === 'Pending'
      ? { label: 'Awaiting confirmation', when: 'pending', strong: false }
      : { label: 'Confirmation email opened', when: record.joined, strong: false },
    ...(record.status === 'Invited'
      ? [
          { label: 'Launch invite sent', when: 'Aug 10', strong: true },
          { label: record.referrals > 10 ? 'Invite opened' : 'Invite not opened yet', when: record.referrals > 10 ? 'Aug 10' : '—', strong: false }
        ]
      : [])
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,42,0.4)', zIndex: 44 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '92vw', background: c.white, zIndex: 45, overflowY: 'auto', padding: 32, boxShadow: '-18px 0 50px rgba(16,24,42,0.22)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: c.soft }}>Waitlist record</div>
            <h2 style={{ margin: '4px 0 0', fontFamily: display, fontSize: 24, fontWeight: 500, overflowWrap: 'anywhere' }}>{record.email}</h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: c.bg, border: 0, width: 34, height: 34, borderRadius: '50%', fontSize: 16, cursor: 'pointer', flex: 'none' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            ['Position', '#' + record.pos],
            ['Referrals', String(record.referrals)],
            ['Moved', record.referrals ? '+' + record.referrals * 3 : '—']
          ].map(([k, v]) => (
            <div key={k} style={{ background: c.bg, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: c.soft }}>{k}</div>
              <div style={{ fontFamily: display, fontSize: 24, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
          <Row label="Status"><span style={statusChip(record.status)}>{record.status}</span></Row>
          <Row label="Joined">{record.joined}</Row>
          <Row label="Source">{record.source}</Row>
          <Row label="Wallet">{record.wallet}</Row>
          <Row label="Referred by">
            {record.source === 'Referral' ? WAITLIST[(record.pos * 3) % WAITLIST.length].email : '—'}
          </Row>
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Email events</div>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '0.5px solid ' + c.line }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.strong ? c.blue : c.bar }} />
              <span style={{ fontSize: 15, fontWeight: 300 }}>{e.label}</span>
              <span style={{ fontSize: 13, color: c.soft, whiteSpace: 'nowrap' }}>{e.when}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Internal note</div>
          <textarea
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Context for the rest of the team…"
            style={{ ...input, width: '100%', resize: 'vertical' }}
          />
          <button type="button" onClick={() => saveNote(record.email, draft)} style={{ ...btnSecondary, marginTop: 10, padding: '10px 20px', fontSize: 14 }}>Save note</button>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 20, borderTop: '0.5px solid ' + c.line }}>
          <button type="button" onClick={() => onInvite(record.email)} style={{ ...btnPrimary, padding: '12px 24px' }}>Send invite</button>
          <button
            type="button"
            onClick={() => { if (isHidden) restore(record.email); else hide([record.email]); onClose(); }}
            style={{ background: c.white, color: c.ink, border: '0.7px solid ' + c.border, padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            {isHidden ? 'Restore record' : 'Hide record'}
          </button>
        </div>
      </aside>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: c.soft }}>{label}</span>
      <span style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>{children}</span>
    </div>
  );
}
