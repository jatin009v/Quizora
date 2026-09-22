import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { getExamState } from '@/lib/exam/service';

export async function GET(
  req: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { attemptId } = params;
    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: 'Attempt ID is required' },
        { status: 400 }
      );
    }

    const result = await getExamState(auth.profile.id, attemptId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('Unauthorized') ? 403 : 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
