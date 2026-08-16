import type { Admin } from './data';

// The one place the admin allowlist is defined. The client guard
// (components/AuthGuard.tsx) and the server check (lib/auth.ts) both parse the
// same string, so they cannot drift apart.
//
// Entries are comma-separated. Each is an email, optionally followed by a
// display name and a role:
//
//   chidileozoemena@gmail.com|Chidile Ozoemena|Owner, ops@uniogate.com|Ops
//
// Names and roles are presentation only — the email is what grants access.
// Anything after the third field is ignored.

const ROLES: Admin['role'][] = ['Owner', 'Admin', 'Support'];

export function parseAllowlist(raw: string | undefined): Admin[] {
  if (!raw) return [];

  const seen = new Set<string>();

  return raw
    .split(',')
    .map(entry => entry.split('|').map(part => part.trim()))
    .flatMap(([rawEmail, rawName, rawRole]) => {
      const email = (rawEmail ?? '').toLowerCase();
      // Reject anything that is not plausibly an address, so a stray comma or
      // a trailing separator cannot widen access.
      if (email.indexOf('@') < 1 || email.endsWith('@')) return [];
      if (seen.has(email)) return [];
      seen.add(email);

      const role = ROLES.find(r => r.toLowerCase() === (rawRole ?? '').toLowerCase());
      return [{ email, name: rawName || email.split('@')[0], role: role ?? 'Admin' }];
    });
}

// Referenced with the full literal so Next inlines it into the client bundle.
export const ADMIN_ALLOWLIST: Admin[] = parseAllowlist(process.env.NEXT_PUBLIC_ADMIN_ALLOWLIST);

export function isAllowed(email: string, admins: Admin[]): boolean {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  return admins.some(a => a.email === normalised);
}
