import { NextRequest, NextResponse } from 'next/server';
import { requireProctor } from '@/lib/auth/session';
import { getProctorAttemptDetails } from '@/lib/proctor/proctorService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await requireProctor();
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json({ success: false, error: 'Attempt ID is required' }, { status: 400 });
    }

    const details = await getProctorAttemptDetails(attemptId);
    return NextResponse.json({ success: true, data: details }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN_ROLE') {
      return NextResponse.json({ success: false, error: 'Proctor access required' }, { status: 403 });
    }
    const status = err.message?.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status });
  }
}
