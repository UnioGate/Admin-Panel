import { PrivyClient } from '@privy-io/server-auth';
import { cookies } from 'next/headers';
import { ADMINS } from './data';

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
    const allowlist = (process.env.ADMIN_ALLOWLIST ?? ADMINS.map(a => a.email).join(','))
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !allowlist.includes(email.toLowerCase())) return null;
    return { userId: claims.userId, email };
  } catch {
    return null;
  }
}
