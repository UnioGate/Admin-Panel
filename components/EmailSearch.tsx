'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Tag, field, micro } from '@/components/ui';
import { searchThreads, type EmailSearchHit, type EmailThread } from '@/lib/email';
import { shortDate } from '@/lib/format';
import { c, display } from '@/lib/theme';

const FIELD_LABEL: Record<EmailSearchHit['field'], string> = {
  subject: 'Subject',
  body: 'Message',
  people: 'Address',
  attachment: 'Attachment'
};

/**
 * Search across the conversations on the page, opened with the button or
 * Cmd/Ctrl-K.
 *
 * It searches what the server already sent, which is deliberate: that list was
 * scoped to the viewer's mailboxes before it left the server, so there is no way
 * for a search to surface mail they cannot open. The cost is that it sees only
 * loaded conversations, which the footer says rather than leaving the reader to
 * assume it swept the whole table.
 */
export default function EmailSearch({
  threads,
  onOpen,
  onClose
}: {
  threads: EmailThread[];
  onOpen: (threadId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => searchThreads(threads, query), [threads, query]);
  const shown = hits.slice(0, 40);

  useEffect(() => { box.current?.focus(); }, []);

  // Follow the selection when it moves past the fold, otherwise arrowing down a
  // long result list walks the highlight off the bottom of the panel.
  useEffect(() => {
    list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(i => Math.min(i + 1, shown.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && shown[cursor]) { e.preventDefault(); onOpen(shown[cursor].thread.id); }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,42,0.45)', zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search email"
        onKeyDown={onKeyDown}
        className="search-panel"
        style={{
          // Square along the top edge it hangs from, rounded where it ends.
          position: 'fixed', zIndex: 61, background: c.white, borderRadius: '0 0 14px 14px',
          boxShadow: '0 24px 70px rgba(16,24,42,0.3)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '18px 22px 16px', borderBottom: '0.5px solid ' + c.faintBorder }}>
          <div style={{ ...micro, color: c.blue, marginBottom: 10 }}>Search mail</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: c.soft, display: 'inline-flex' }}>{Icon.search(18)}</span>
            <input
              ref={box}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                // Back to the top with the term: the old cursor pointed into a
                // different result list and would land on an unrelated thread.
                setCursor(0);
              }}
              placeholder="Subject, message text, address or filename…"
              style={{
                ...field, border: 0, padding: 0, flex: 1, minWidth: 0,
                fontSize: 22, fontFamily: display, fontWeight: 600, letterSpacing: '-0.01em'
              }}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              style={{ background: 'transparent', border: '0.7px solid ' + c.faintBorder, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: c.muted, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {Icon.close(14)}
            </button>
          </div>
        </div>

        <div ref={list} style={{ overflowY: 'auto', flex: 1 }}>
          {!query.trim() ? (
            <Note>Type to search. ↑↓ to move, Enter to open, Esc to close.</Note>
          ) : shown.length === 0 ? (
            <Note>No conversation matches “{query.trim()}”.</Note>
          ) : shown.map((hit, i) => (
            <Result
              key={hit.thread.id}
              hit={hit}
              query={query.trim()}
              on={i === cursor}
              onHover={() => setCursor(i)}
              onPick={() => onOpen(hit.thread.id)}
            />
          ))}
        </div>

        <div style={{ ...micro, padding: '12px 22px', borderTop: '0.5px solid ' + c.faintBorder, background: c.bg, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>
            {query.trim()
              ? hits.length + ' match' + (hits.length === 1 ? '' : 'es') +
                (hits.length > shown.length ? ' · showing the first ' + shown.length : '')
              : 'Searching your mailboxes'}
          </span>
          <span>{threads.length} conversation{threads.length === 1 ? '' : 's'} loaded</span>
        </div>
      </div>
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '28px 20px', fontSize: 14, color: c.soft, fontWeight: 300, textAlign: 'center' }}>
      {children}
    </div>
  );
}

function Result({
  hit, query, on, onHover, onPick
}: {
  hit: EmailSearchHit;
  query: string;
  on: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const { thread } = hit;
  const inbound = hit.message ? hit.message.direction === 'inbound' : thread.lastDirection === 'inbound';

  return (
    <button
      type="button"
      data-on={on}
      onMouseEnter={onHover}
      onClick={onPick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer',
        background: on ? '#F4F6FA' : c.white, borderBottom: '0.5px solid ' + c.line,
        borderLeft: '3px solid ' + (on ? c.blue : 'transparent'), padding: '14px 22px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span aria-hidden style={{ color: inbound ? c.blue : c.soft, marginRight: 6 }}>
            {inbound ? '↓' : '↑'}
          </span>
          {thread.subject}
        </span>
        <span style={{ fontSize: 11, color: c.soft, whiteSpace: 'nowrap' }}>{shortDate(thread.lastActivity)}</span>
      </div>

      <div style={{ fontSize: 13, color: c.muted, marginTop: 4, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
        <Highlight text={hit.snippet} at={hit.at} length={query.length} />
      </div>

      <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 7, flexWrap: 'wrap', fontSize: 11, color: c.soft }}>
        {/* Which of the four fields matched, so a hit whose snippet is a line of
            body text does not look like it came out of nowhere. */}
        <Tag tone="tint">{FIELD_LABEL[hit.field]}</Tag>
        {thread.mailbox ? <Tag>{thread.mailbox}</Tag> : null}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {thread.correspondents[0] ?? 'Unknown sender'}
        </span>
        {thread.attachmentCount > 0 ? (
          <span aria-label="Has attachments" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {Icon.clip(12)} {thread.attachmentCount}
          </span>
        ) : null}
      </div>
    </button>
  );
}

/** Marks the term inside the snippet, so a hit in a long body is findable by eye. */
function Highlight({ text, at, length }: { text: string; at: number; length: number }) {
  if (at < 0 || length <= 0 || at + length > text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark style={{ background: '#FFE79A', color: c.ink, padding: '0 1px', borderRadius: 2 }}>
        {text.slice(at, at + length)}
      </mark>
      {text.slice(at + length)}
    </>
  );
}
