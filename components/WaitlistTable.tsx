'use client';

import { useMemo, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import InviteModal from '@/components/InviteModal';
import PageHeader from '@/components/PageHeader';
import RecordDrawer from '@/components/RecordDrawer';
import type { WaitlistEntry } from '@/lib/data';
import { shortDate } from '@/lib/format';
import { useAdmin } from '@/lib/store';
import { c, pill } from '@/lib/theme';

const PER_PAGE = 12;
const FILTERS = ['All', 'Subscribed', 'Unsubscribed', 'Hidden'] as const;
type SortKey = 'pos' | 'email' | 'createdAt' | 'unsubscribed';
const COLS: [SortKey, string, 'left' | 'right'][] = [
  ['pos', '#', 'left'],
  ['email', 'Email', 'left'],
  ['createdAt', 'Joined', 'left'],
  ['unsubscribed', 'Mailing', 'left']
];

export default function WaitlistTable({ entries }: { entries: WaitlistEntry[] }) {
  const { hide, restore, note, flash } = useAdmin();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [sortKey, setSortKey] = useState<SortKey>('pos');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<string | null>(null);
  const [invite, setInvite] = useState<string[] | null>(null);
  const [confirmHide, setConfirmHide] = useState<string[] | null>(null);

  const selected = useMemo(() => Object.keys(sel).filter(e => sel[e]), [sel]);

  const sorted = useMemo(() => {
    const query = q.trim().toLowerCase();
    const matched = entries
      // hidden_at is filtered here rather than in SQL because the column only
      // exists after the migration. Move this into the query once volume grows.
      .filter(r => (filter === 'Hidden' ? r.hiddenAt !== null : r.hiddenAt === null))
      .filter(r => filter === 'All' || filter === 'Hidden'
        || (filter === 'Unsubscribed' ? r.unsubscribed : !r.unsubscribed))
      .filter(r => !query || r.email.toLowerCase().includes(query));

    const val = (r: WaitlistEntry) => {
      const v = r[sortKey];
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return String(v).toLowerCase();
    };

    return [...matched].sort((a, b) => {
      const x = val(a), y = val(b);
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [entries, q, filter, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  const pageAllOn = slice.length > 0 && slice.every(r => sel[r.email]);

  const mailable = entries.filter(r => !r.unsubscribed && r.hiddenAt === null).map(r => r.email);
  const record = detail ? entries.find(r => r.email === detail) ?? null : null;

  const exportCsv = () => {
    const rows = [
      ['position', 'email', 'joined', 'unsubscribed'],
      ...sorted.map(r => [String(r.pos), r.email, r.createdAt, String(r.unsubscribed)])
    ];
    const csv = rows.map(cells => cells.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uniogate-waitlist.csv';
    a.click();
    URL.revokeObjectURL(url);
    note('Exported the waitlist to CSV', 'Export', sorted.length + ' rows');
    flash('uniogate-waitlist.csv is downloading.');
  };

  const sendInvites = (emails: string[]) => {
    // TODO: POST /api/invites once a transactional provider is wired. The route
    // currently queues nothing, so do not claim the mail was sent.
    setInvite(null);
    setSel({});
    flash('Invites are not wired up yet — no email was sent to ' + emails.length + ' address' + (emails.length === 1 ? '' : 'es') + '.');
  };

  return (
    <>
      <PageHeader
        title="Waitlist"
        subtitle={entries.length + ' signup' + (entries.length === 1 ? '' : 's') + ' · ' + mailable.length + ' mailable'}
      />

      <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Search email"
            style={{ border: '0.7px solid ' + c.border, borderRadius: 20, padding: '12px 20px', fontSize: 15, background: c.white, outline: 0, minWidth: 280 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {FILTERS.map(f => (
              <button key={f} type="button" onClick={() => { setFilter(f); setPage(0); }} style={pill(filter === f)}>{f}</button>
            ))}
          </div>
          <span style={{ fontSize: 14, color: c.muted }}>{sorted.length} of {entries.length} shown</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button type="button" onClick={exportCsv} style={{ background: c.white, color: c.blue, border: '0.7px solid ' + c.blue, padding: '12px 22px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Export CSV</button>
            <button type="button" onClick={() => setInvite(selected.length ? selected : mailable)} style={{ background: c.blue, color: c.white, border: 0, padding: '12px 22px', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Send invites</button>
          </div>
        </div>

        {selected.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: c.ink, color: c.white, borderRadius: 10, padding: '14px 20px' }}>
            <span style={{ fontSize: 15 }}>{selected.length} record{selected.length === 1 ? '' : 's'} selected</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setInvite(selected)} style={{ background: c.white, color: c.ink, border: 0, padding: '9px 18px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Invite selected</button>
              <button type="button" onClick={() => setConfirmHide(selected)} style={{ background: 'transparent', color: c.white, border: '0.7px solid ' + c.sidebarBorder, padding: '9px 18px', borderRadius: 20, fontSize: 14, cursor: 'pointer' }}>Hide selected</button>
              <button type="button" onClick={() => setSel({})} style={{ background: 'transparent', color: c.sidebarMuted, border: 0, padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        ) : null}

        <div style={{ background: c.white, borderRadius: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, fontSize: 15 }}>
            <thead>
              <tr style={{ background: '#F4F6FA', color: c.muted, textAlign: 'left' }}>
                <th style={{ padding: '14px 12px 14px 20px', fontWeight: 500, width: 44 }}>
                  <button
                    type="button"
                    aria-label="Select all on page"
                    onClick={() => setSel(s => { const next = { ...s }; slice.forEach(r => { next[r.email] = !pageAllOn; }); return next; })}
                    style={{ width: 18, height: 18, borderRadius: 4, border: '0.7px solid ' + c.border, background: pageAllOn ? c.blue : c.white, color: c.white, fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0 }}
                  >
                    {pageAllOn ? '✓' : ''}
                  </button>
                </th>
                {COLS.map(([key, label, align]) => (
                  <th key={key} style={{ padding: '14px 20px', fontWeight: 500, textAlign: align }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPage(0);
                        setSortDir(d => (sortKey === key && d === 'asc' ? 'desc' : 'asc'));
                        setSortKey(key);
                      }}
                      style={{ background: 'transparent', border: 0, padding: 0, fontSize: 15, fontWeight: 500, color: c.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <span>{label}</span>
                      <span style={{ color: c.blue, fontSize: 12 }}>{sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                ))}
                <th style={{ padding: '14px 20px', fontWeight: 500, textAlign: 'right' }}>Record</th>
              </tr>
            </thead>
            <tbody>
              {slice.map(r => {
                const on = !!sel[r.email];
                const isHidden = r.hiddenAt !== null;
                return (
                  <tr
                    key={r.email}
                    onClick={() => setDetail(r.email)}
                    style={{ borderTop: '0.5px solid ' + c.line, cursor: 'pointer', background: on ? '#F4F6FA' : c.white }}
                  >
                    <td style={{ padding: '16px 12px 16px 20px' }}>
                      <button
                        type="button"
                        aria-label={'Select ' + r.email}
                        onClick={e => { e.stopPropagation(); setSel(s => ({ ...s, [r.email]: !s[r.email] })); }}
                        style={{ width: 18, height: 18, borderRadius: 4, border: '0.7px solid ' + c.border, background: on ? c.blue : c.white, color: c.white, fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0 }}
                      >
                        {on ? '✓' : ''}
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px', color: c.soft }}>{r.pos}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 500 }}>{r.email}</td>
                    <td style={{ padding: '16px 20px', color: c.muted }}>{shortDate(r.createdAt)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 20, fontSize: 13, background: r.unsubscribed ? c.bg : c.blueTint, color: r.unsubscribed ? c.muted : c.blue }}>
                        {r.unsubscribed ? 'Unsubscribed' : 'Subscribed'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); if (isHidden) void restore(r.email); else setConfirmHide([r.email]); }}
                        style={{ background: 'transparent', border: '0.7px solid ' + (isHidden ? c.blue : c.bar), color: isHidden ? c.blue : c.muted, padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer' }}
                      >
                        {isHidden ? 'Restore' : 'Hide'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: c.muted, fontWeight: 300 }}>No records match this filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: c.muted }}>Page {current + 1} of {pages} · showing {slice.length} records</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setPage(Math.max(0, current - 1))} style={{ background: c.white, color: current === 0 ? '#9AA0AE' : c.blue, border: '0.7px solid ' + c.faintBorder, padding: '10px 20px', borderRadius: 20, fontSize: 14, cursor: 'pointer' }}>Previous</button>
            <button type="button" onClick={() => setPage(Math.min(pages - 1, current + 1))} style={{ background: c.white, color: current >= pages - 1 ? '#9AA0AE' : c.blue, border: '0.7px solid ' + c.faintBorder, padding: '10px 20px', borderRadius: 20, fontSize: 14, cursor: 'pointer' }}>Next</button>
          </div>
        </div>
      </div>

      {record ? (
        <RecordDrawer
          key={record.email}
          record={record}
          onClose={() => setDetail(null)}
          onInvite={email => { setDetail(null); setInvite([email]); }}
        />
      ) : null}

      {invite ? (
        <InviteModal
          base={invite}
          scoped={selected.length > 0 || invite.length === 1}
          onClose={() => setInvite(null)}
          onSend={sendInvites}
        />
      ) : null}

      {confirmHide ? (
        <ConfirmModal
          title={confirmHide.length === 1 ? 'Hide this waitlist record?' : 'Hide ' + confirmHide.length + ' waitlist records?'}
          body="The row leaves the console, exports and invite batches. Under our retention policy the underlying record is kept 30 days for legal and accounting purposes, then anonymised — restore it from the Hidden filter until then."
          cta={confirmHide.length === 1 ? 'Hide record' : 'Hide records'}
          ctaColor={c.ink}
          onCancel={() => setConfirmHide(null)}
          onConfirm={() => { void hide(confirmHide); setSel({}); setConfirmHide(null); }}
        />
      ) : null}
    </>
  );
}
