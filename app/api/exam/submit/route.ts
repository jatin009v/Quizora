import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { SubmitExamSchema } from '@/lib/validation/paper';
import { submitExamAttempt } from '@/lib/exam/submissionService';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = SubmitExamSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'Invalid submission payload' },
        { status: 400 }
      );
    }

    const result = await submitExamAttempt(
      auth.profile.id,
      validation.data.attemptId,
      validation.data.unconfirmedAnswers
    );

    if (!result.success) {
      let status = 400;
      if (result.code === 'UNAUTHORIZED_ATTEMPT') status = 403;
      if (result.code === 'ATTEMPT_NOT_FOUND') status = 404;
      if (result.code === 'ATTEMPT_SUBMITTED' || result.code === 'ATTEMPT_LOCKED') status = 409;

      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
