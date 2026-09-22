import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthContext();

  if (!auth) {
    const res = NextResponse.json({ authenticated: false }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  }

  const res = NextResponse.json({
    authenticated: true,
    user: auth.user,
    profile: auth.profile,
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
