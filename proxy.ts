import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Coarse gate: no Privy session cookie, no /admin. The real identity check runs in
// AuthGuard (client) and in each route handler via @privy-io/server-auth.
export function proxy(req: NextRequest) {
  const token = req.cookies.get('privy-token')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
