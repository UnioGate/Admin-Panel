'use client';

import { c, display, input } from '@/lib/theme';

/**
 * The small pieces the Settings and Email pages are built from.
 *
 * They exist because those two pages share a vocabulary — a numbered section, a
 * button in one of five weights, a chip, a labelled field — and repeating it
 * inline in both is how the two drift apart. Everything here is presentational
 * and client-safe: no `@/lib/supabase`, directly or otherwise.
 */

/** Uppercase micro-label. The page's smallest voice: names a thing, never says anything. */
export const micro: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.16em',
  textTransform: 'uppercase', fontWeight: 500, color: c.soft
};

/** A form control that fills its column, rather than sizing to its content. */
export const field: React.CSSProperties = { ...input, width: '100%', padding: '11px 12px', fontFamily: 'inherit' };

/** The same, at the size a control inside a table row wants. */
export const fieldSm: React.CSSProperties = {
  ...field, padding: '9px 10px', fontSize: 13, border: '0.7px solid ' + c.faintBorder
};

/**
 * Line icons rather than emoji. A paperclip glyph renders as a different picture
 * on every platform and at a size the surrounding text does not control; this
 * inherits both colour and weight.
 */
export const Icon = {
  clip: (size = 14) => (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />
    </svg>
  ),
  search: (size = 14) => (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"
      style={{ flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  ),
  close: (size = 14) => (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden focusable="false" style={{ flexShrink: 0 }}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  back: (size = 14) => (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 6l-6 6 6 6" />
    </svg>
  ),
  reply: (size = 14) => (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h7a6 6 0 0 1 6 6v4" />
    </svg>
  )
};

export type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid';

const BTN_KIND: Record<BtnKind, React.CSSProperties> = {
  primary: { background: c.blue, color: c.white, border: '0.7px solid ' + c.blue },
  secondary: { background: c.white, color: c.blue, border: '0.7px solid ' + c.blue },
  ghost: { background: 'transparent', color: c.muted, border: '0.7px solid ' + c.faintBorder },
  // Outline until it is armed, solid once it is: the two-step delete says which
  // step it is on with the button's weight, not only its word.
  danger: { background: 'transparent', color: c.danger, border: '0.7px solid ' + c.danger },
  dangerSolid: { background: c.danger, color: c.white, border: '0.7px solid ' + c.danger }
};

export function Btn({
  kind = 'secondary', children, style, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
        letterSpacing: '0.01em', padding: '11px 18px', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        ...BTN_KIND[kind], ...style
      }}
    >
      {children}
    </button>
  );
}

export type TagTone = 'neutral' | 'accent' | 'tint' | 'quiet';

const TAG_TONE: Record<TagTone, React.CSSProperties> = {
  neutral: { background: c.bg, color: c.muted },
  accent: { background: c.blue, color: c.white },
  tint: { background: c.blueTint, color: c.blue },
  quiet: { background: 'transparent', color: c.soft, border: '0.7px solid ' + c.faintBorder }
};

export function Tag({
  children, tone = 'neutral', title
}: {
  children: React.ReactNode;
  tone?: TagTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 10,
        letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap',
        ...TAG_TONE[tone]
      }}
    >
      {children}
    </span>
  );
}

/** A control under its own name. The label is the element, so clicking it focuses. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <span style={micro}>{label}</span>
      {children}
    </label>
  );
}

/**
 * A numbered section under a rule — the settings page's only organising device.
 * Cards would put a box around each of four things that are all the same kind of
 * thing; a number and a rule say the same and leave the width to the content.
 */
export function Section({
  n, title, note, children
}: {
  n: string;
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ ...micro, color: c.blue, fontWeight: 600 }}>{n}</span>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', color: c.ink }}>
          {title}
        </h2>
      </div>
      {note ? (
        <p style={{ margin: '10px 0 0', maxWidth: '78ch', fontSize: 15, lineHeight: 1.65, fontWeight: 300, color: c.muted }}>
          {note}
        </p>
      ) : null}
      <div style={{ borderTop: '0.7px solid ' + c.faintBorder, marginTop: 16 }} />
      {children}
    </section>
  );
}

/** Something the reader has to go and do elsewhere before this section works. */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: c.bg, borderLeft: '3px solid ' + c.blue, borderRadius: '0 10px 10px 0',
        padding: '18px 20px', marginTop: 20, fontSize: 15, lineHeight: 1.7, fontWeight: 300, color: c.muted
      }}
    >
      {children}
    </div>
  );
}
