import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.profile) {
      return NextResponse.json(
        { success: false, error: 'Unable to load profile. Please sign in again.' },
        { status: 401 }
      );
    }

    const { name, course, year, username, role, status } = auth.profile;

    return NextResponse.json(
      {
        success: true,
        profile: {
          name,
          course,
          year,
          username,
          role,
          status,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
