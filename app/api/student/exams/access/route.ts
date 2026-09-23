import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAccessCode } from '@/lib/exam/accessCode';
import { createOrRecoverExamAttempt } from '@/lib/exam/attemptService';
import { mockExamStore } from '@/lib/exam/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = req.headers.get('QUIZORA-REQUEST-ID') || crypto.randomUUID();

  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'STUDENT') {
      return NextResponse.json(
        { success: false, error: 'Student authentication required' },
        { status: 401, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    if (auth.profile.status === 'DISABLED') {
      return NextResponse.json(
        { success: false, error: 'Student account is disabled.' },
        { status: 403, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    const body = await req.json();
    const rawCode = body.accessCode || body.access_code;
    const normalizedCode = normalizeAccessCode(rawCode);

    if (!normalizedCode) {
      return NextResponse.json(
        { success: false, error: 'Please enter an examination access code.' },
        { status: 400, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    const nowMs = Date.now();
    let dbStart = Date.now();
    let paper: any = null;

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const papers = Array.from(mockExamStore.papers.values());
      paper = papers.find(
        (p) => normalizeAccessCode(p.access_code) === normalizedCode && p.status === 'PUBLISHED'
      );
    } else {
      const supabase = createAdminClient();
      const { data: foundPaper, error: paperErr } = await supabase
        .from('papers')
        .select('*')
        .eq('status', 'PUBLISHED')
        .ilike('access_code', normalizedCode)
        .maybeSingle();

      if (paperErr || !foundPaper) {
        return NextResponse.json(
          { success: false, error: 'Invalid or unavailable examination access code.' },
          { status: 400, headers: { 'QUIZORA-REQUEST-ID': requestId } }
        );
      }
      paper = foundPaper;
    }
    const dbMs = Date.now() - dbStart;

    if (!paper) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unavailable examination access code.' },
        { status: 400, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    // 1. Course Eligibility Validation
    if (
      paper.course &&
      auth.profile.course &&
      paper.course.trim().toUpperCase() !== auth.profile.course.trim().toUpperCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `This examination is reserved for ${paper.course} students. Your profile course is ${auth.profile.course}.`,
        },
        { status: 403, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    // 2. Schedule Access Window Validation
    if (paper.start_at && nowMs < new Date(paper.start_at).getTime()) {
      return NextResponse.json(
        { success: false, error: 'Exam access has not started yet. Please contact your administrator.' },
        { status: 425, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    // 3. Check for existing attempt before schedule expiry rejection
    let existingAttempt: any = null;
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const attempts = Array.from(mockExamStore.attempts.values());
      existingAttempt = attempts.find(
        (a) => a.user_id === auth.profile.id && a.paper_id === paper.id
      );
    } else {
      const supabase = createAdminClient();
      const { data: attData } = await supabase
        .from('exam_attempts')
        .select('id, status, expires_at')
        .eq('user_id', auth.profile.id)
        .eq('paper_id', paper.id)
        .maybeSingle();
      existingAttempt = attData;
    }

    if (existingAttempt) {
      if (existingAttempt.status === 'SUBMITTED') {
        return NextResponse.json(
          { success: false, error: 'You have already submitted this exam.' },
          { status: 409, headers: { 'QUIZORA-REQUEST-ID': requestId } }
        );
      }
      if (existingAttempt.status === 'LOCKED') {
        return NextResponse.json(
          { success: false, error: 'This exam attempt has been locked by the proctor.' },
          { status: 409, headers: { 'QUIZORA-REQUEST-ID': requestId } }
        );
      }
    }

    // If after end_at AND student has NO active attempt -> reject expired code
    if (paper.end_at && nowMs > new Date(paper.end_at).getTime() && !existingAttempt) {
      return NextResponse.json(
        { success: false, error: 'Exam access has closed. The access code has expired. Please contact your administrator.' },
        { status: 410, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    // 4. Start or recover attempt atomically
    const attemptStart = Date.now();
    const attemptResult = await createOrRecoverExamAttempt(auth.profile.id, paper.id);
    const attemptMs = Date.now() - attemptStart;
    const totalMs = Date.now() - startTime;

    if (!attemptResult.success || !attemptResult.data) {
      let httpStatus = 400;
      if (attemptResult.code === 'ATTEMPT_SUBMITTED' || attemptResult.code === 'ATTEMPT_LOCKED') {
        httpStatus = 409;
      }

      console.error('[EXAM_ACCESS_ERROR]', {
        requestId,
        studentId: auth.profile.id,
        paperId: paper.id,
        code: attemptResult.code,
        message: attemptResult.error,
        httpStatus,
      });

      return NextResponse.json(
        { success: false, error: attemptResult.error || 'Failed to initialize exam attempt.' },
        { status: httpStatus, headers: { 'QUIZORA-REQUEST-ID': requestId } }
      );
    }

    console.info('[EXAM_ACCESS]', {
      requestId,
      paperId: paper.id,
      studentId: auth.profile.id,
      dbMs,
      attemptMs,
      totalMs,
      status: 200,
    });

    return NextResponse.json(
      {
        success: true,
        paperId: paper.id,
        attemptId: attemptResult.data.attemptId,
        status: attemptResult.data.status,
        data: {
          paperId: paper.id,
          attemptId: attemptResult.data.attemptId,
          status: attemptResult.data.status,
        },
      },
      { status: 200, headers: { 'QUIZORA-REQUEST-ID': requestId } }
    );
  } catch (err: any) {
    console.error('[EXAM_ACCESS_UNCAUGHT_ERROR]', {
      requestId,
      error: err.message,
    });

    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500, headers: { 'QUIZORA-REQUEST-ID': requestId } }
    );
  }
}
