import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function performLogout() {
  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Logout error:', err);
  }

  // Force cookie clearing as safety fallback
  try {
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (c.name.includes('sb-') || c.name.includes('supabase') || c.name.includes('token') || c.name.includes('auth')) {
        cookieStore.set(c.name, '', { path: '/', expires: new Date(0) });
      }
    }
  } catch (err) {
    // Ignore cookie clearing error in edge contexts
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function POST() {
  return performLogout();
}

export async function GET() {
  return performLogout();
}
