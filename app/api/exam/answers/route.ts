import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { SaveAnswerSchema } from '@/lib/validation/exam';
import { saveExamAnswer } from '@/lib/exam/service';

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
    const validation = SaveAnswerSchema.safeParse(body);

    if (!validation.success) {
      const issue = validation.error.issues[0]?.message || 'Invalid answer payload';
      return NextResponse.json({ success: false, error: issue }, { status: 400 });
    }

    const result = await saveExamAnswer(auth.profile.id, validation.data);

    if (!result.success) {
      let status = 400;
      if (result.code === 'UNAUTHORIZED_ATTEMPT') status = 403;
      if (result.code === 'ATTEMPT_NOT_FOUND' || result.code === 'INVALID_QUESTION') status = 404;
      if (result.code === 'ATTEMPT_LOCKED' || result.code === 'ATTEMPT_SUBMITTED') status = 409;
      if (result.code === 'EXAM_EXPIRED') status = 410;

      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (err) {
    console.error('API /api/exam/answers error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
