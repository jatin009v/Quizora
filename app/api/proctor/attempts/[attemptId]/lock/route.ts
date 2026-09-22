import { NextRequest, NextResponse } from 'next/server';
import { requireProctor } from '@/lib/auth/session';
import { proctorLockAttempt } from '@/lib/proctor/proctorService';
import { ProctorLockActionSchema } from '@/lib/validation/proctor';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const auth = await requireProctor();
    const { attemptId } = await params;

    const body = await req.json().catch(() => ({}));
    const validation = ProctorLockActionSchema.safeParse(body);

    const reason = validation.success ? validation.data.reason : 'Manual proctor lock';

    const result = await proctorLockAttempt(attemptId, auth.profile.id, reason);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN_ROLE') {
      return NextResponse.json({ success: false, error: 'Proctor access required' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message || 'Failed to lock attempt' }, { status: 400 });
  }
}
