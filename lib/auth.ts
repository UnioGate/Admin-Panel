import { PrivyClient } from '@privy-io/server-auth';
import { cookies } from 'next/headers';
import { findAdmin } from './admins';
import type { AdminRole } from './data';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
  process.env.PRIVY_APP_SECRET ?? ''
);

export type AdminSession = { userId: string; email: string; name: string; role: AdminRole };

// Verify the Privy session cookie and look the email up in the `admins` table.
// Every admin route handler should call this before touching data.
//
// This costs one indexed single-row read per request. That is the price of the
// allowlist being editable at runtime instead of baked into the environment —
// worth it, and cheap next to the Privy round trip above it.
export async function requireAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get('privy-token')?.value;
  if (!token) return null;

  try {
    const claims = await privy.verifyAuthToken(token);
    const user = await privy.getUser(claims.userId);
    const email = user.email?.address ?? '';

    // No fallback. If the table is missing or empty, nobody is an admin —
    // failing closed is the only safe direction for an access check.
    const admin = await findAdmin(email);
    if (!admin) return null;

    // Identity and role both come from the row, never from the request, so a
    // client that edits its own copy of the list gains nothing.
    return { userId: claims.userId, email: admin.email, name: admin.name, role: admin.role };
  } catch {
    return null;
  }
}
