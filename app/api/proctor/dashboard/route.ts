import { NextRequest, NextResponse } from 'next/server';
import { requireProctor } from '@/lib/auth/session';
import { getProctorDashboardSummary } from '@/lib/proctor/proctorService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireProctor();

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId') || undefined;

    const summary = await getProctorDashboardSummary(paperId);

    return NextResponse.json({ success: true, data: summary }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN_ROLE') {
      return NextResponse.json({ success: false, error: 'Proctor access required' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
