import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { AccessCodeSchema } from '@/lib/validation/attempt';
import { accessCodeRateLimiter } from '@/lib/exam/rateLimiter';
import { validateAccessCodeServerSide } from '@/lib/exam/attemptService';

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

    // Rate Limiter Check per student ID
    const rateCheck = accessCodeRateLimiter.isRateLimited(auth.profile.id, 5, 60000);
    if (rateCheck.limited) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many invalid attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
          code: 'RATE_LIMITED',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = AccessCodeSchema.safeParse(body);

    if (!validation.success) {
      accessCodeRateLimiter.recordAttempt(auth.profile.id);
      return NextResponse.json(
        { success: false, error: 'Invalid or unavailable exam code.' },
        { status: 400 }
      );
    }

    const result = await validateAccessCodeServerSide(auth.profile.id, validation.data.accessCode);

    if (!result.success) {
      accessCodeRateLimiter.recordAttempt(auth.profile.id);
      let status = 400;
      if (result.code === 'EXAM_NOT_STARTED' || result.code === 'EXAM_ENDED') status = 403;
      if (result.code === 'ATTEMPT_SUBMITTED' || result.code === 'ATTEMPT_LOCKED') status = 409;

      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    // Reset rate limiter on valid code
    accessCodeRateLimiter.reset(auth.profile.id);

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
