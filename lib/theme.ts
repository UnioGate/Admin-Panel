// Shared with the marketing site — Sora + Plus Jakarta Sans, #E9ECF3 ground, #253E86 blue.
export const c = {
  bg: '#E9ECF3',
  ink: '#10182A',
  blue: '#253E86',
  blueDark: '#1B2F68',
  blueTint: '#DDE3F2',
  muted: '#4A5163',
  soft: '#6B7280',
  line: '#E1E5EE',
  border: '#5C5050',
  faintBorder: '#D5DAE5',
  bar: '#B8C2DC',
  sidebarHover: '#1C2745',
  sidebarBorder: '#3A4468',
  sidebarMuted: '#8C9AC0',
  white: '#fff'
} as const;

export const display = "'Plus Jakarta Sans', sans-serif";

export const card: React.CSSProperties = { background: c.white, borderRadius: 10, padding: 28 };

export const btnPrimary: React.CSSProperties = {
  background: c.blue, color: c.white, border: 0, padding: '13px 26px', borderRadius: 10,
  fontSize: 15, fontWeight: 600, cursor: 'pointer'
};

export const btnSecondary: React.CSSProperties = {
  background: c.white, color: c.blue, border: '0.7px solid ' + c.blue, padding: '13px 26px',
  borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer'
};

export const input: React.CSSProperties = {
  border: '0.7px solid ' + c.border, borderRadius: 10, padding: '13px 16px', fontSize: 15,
  background: c.white, outline: 0
};

export const pill = (on: boolean): React.CSSProperties => ({
  padding: '11px 18px', borderRadius: 20, fontSize: 15, cursor: 'pointer',
  border: '0.7px solid ' + c.border, background: on ? c.ink : 'transparent', color: on ? c.white : c.ink
});

// No fontSize: it is set by `.page-title` in globals.css so it can shrink on
// narrow screens. An inline value here would win over the media query.
export const h1: React.CSSProperties = { margin: 0, fontFamily: display, fontWeight: 400, lineHeight: '110%' };
export const h2: React.CSSProperties = { margin: 0, fontFamily: display, fontSize: 22, fontWeight: 500 };

export const statusChip = (status: string): React.CSSProperties => ({
  display: 'inline-block', padding: '5px 14px', borderRadius: 20, fontSize: 13,
  background: status === 'Invited' ? c.blue : status === 'Confirmed' ? c.blueTint : c.bg,
  color: status === 'Invited' ? c.white : status === 'Confirmed' ? c.blue : c.muted
});
