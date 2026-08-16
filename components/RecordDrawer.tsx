'use client';

import { useState } from 'react';
import type { WaitlistEntry } from '@/lib/data';
import { shortDate } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { btnPrimary, btnSecondary, c, display, input } from '@/lib/theme';

export default function RecordDrawer({
  record, onClose, onInvite
}: {
  record: WaitlistEntry;
  onClose: () => void;
  onInvite: (email: string) => void;
}) {
  const { notes, saveNote, hide, restore } = useAdmin();
  // The caller keys this drawer on record.email, so a remount reseeds the draft.
  const [draft, setDraft] = useState(notes[record.email] ?? '');

  const isHidden = record.hiddenAt !== null;

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
          <Row label="Position">#{record.pos}</Row>
          <Row label="Joined">{shortDate(record.createdAt)}</Row>
          <Row label="Mailing list">{record.unsubscribed ? 'Unsubscribed' : 'Subscribed'}</Row>
          <Row label="Hidden">{isHidden ? shortDate(record.hiddenAt as string) : 'No'}</Row>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: c.soft, lineHeight: 1.6, fontWeight: 300 }}>
          This is everything the waitlist table stores. Source, wallet and referral data would have to be
          captured by the signup form on the marketing site first.
        </p>

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
            onClick={() => { if (isHidden) void restore(record.email); else void hide([record.email]); onClose(); }}
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
