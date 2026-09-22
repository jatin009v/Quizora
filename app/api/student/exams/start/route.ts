import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { StartExamSchema } from '@/lib/validation/attempt';
import { createOrRecoverExamAttempt } from '@/lib/exam/attemptService';

export const dynamic = 'force-dynamic';

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
    const validation = StartExamSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid paper ID format' },
        { status: 400 }
      );
    }

    const result = await createOrRecoverExamAttempt(auth.profile.id, validation.data.paperId);

    if (!result.success) {
      let status = 400;
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
