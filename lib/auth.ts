import { PrivyClient } from '@privy-io/server-auth';
import { cookies } from 'next/headers';
import { isAllowed, parseAllowlist } from './allowlist';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
  process.env.PRIVY_APP_SECRET ?? ''
);

export type AdminSession = { userId: string; email: string };

// Verify the Privy session cookie and check the email against the allowlist.
// Every admin route handler should call this before touching data.
export async function requireAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get('privy-token')?.value;
  if (!token) return null;

  try {
    const claims = await privy.verifyAuthToken(token);
    const user = await privy.getUser(claims.userId);
    const email = user.email?.address ?? '';
    // Prefer the server-only var; fall back to the public one the client guard
    // reads so a single-var setup still works. No mock fallback: an unset
    // allowlist admits nobody.
    const allowlist = parseAllowlist(
      process.env.ADMIN_ALLOWLIST ?? process.env.NEXT_PUBLIC_ADMIN_ALLOWLIST
    );

    if (!isAllowed(email, allowlist)) return null;
    return { userId: claims.userId, email };
  } catch {
    return null;
  }
}
