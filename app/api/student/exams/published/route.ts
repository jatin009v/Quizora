import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { listPublishedPapersForStudent } from '@/lib/exam/attemptService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await listPublishedPapersForStudent();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
