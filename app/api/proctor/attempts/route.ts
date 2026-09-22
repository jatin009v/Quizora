import { NextRequest, NextResponse } from 'next/server';
import { requireProctor } from '@/lib/auth/session';
import { listProctorStudentAttempts } from '@/lib/proctor/proctorService';
import { ProctorAttemptFilterSchema } from '@/lib/validation/proctor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireProctor();

    const { searchParams } = new URL(req.url);
    const rawFilter = {
      status: searchParams.get('status') || 'ALL',
      paperId: searchParams.get('paperId') || undefined,
      course: searchParams.get('course') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const filters = ProctorAttemptFilterSchema.parse(rawFilter);
    const attempts = await listProctorStudentAttempts(filters);

    return NextResponse.json({ success: true, data: attempts }, { status: 200 });
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
