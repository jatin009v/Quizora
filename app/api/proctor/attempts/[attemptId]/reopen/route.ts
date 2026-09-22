import { NextRequest, NextResponse } from 'next/server';
import { requireProctor } from '@/lib/auth/session';
import { proctorReopenAttempt } from '@/lib/proctor/proctorService';
import { ProctorReopenActionSchema } from '@/lib/validation/proctor';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const auth = await requireProctor();
    const { attemptId } = await params;

    const body = await req.json().catch(() => ({}));
    const validation = ProctorReopenActionSchema.safeParse(body);

    const reason = validation.success ? validation.data.reason : 'Manual proctor reopen';

    const result = await proctorReopenAttempt(attemptId, auth.profile.id, reason);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN_ROLE') {
      return NextResponse.json({ success: false, error: 'Proctor access required' }, { status: 403 });
    }
    const status = err.message?.includes('expired') ? 400 : 400;
    return NextResponse.json({ success: false, error: err.message || 'Failed to reopen attempt' }, { status });
  }
}
