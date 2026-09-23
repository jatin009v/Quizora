import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAccessCode } from '@/lib/exam/accessCode';
import { createOrRecoverExamAttempt } from '@/lib/exam/attemptService';
import { mockExamStore } from '@/lib/exam/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'STUDENT') {
      return NextResponse.json(
        { success: false, error: 'Student authentication required' },
        { status: 401 }
      );
    }

    if (auth.profile.status === 'DISABLED') {
      return NextResponse.json(
        { success: false, error: 'Student account is disabled.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const rawCode = body.accessCode || body.access_code;
    const normalizedCode = normalizeAccessCode(rawCode);

    if (!normalizedCode) {
      return NextResponse.json(
        { success: false, error: 'Please enter an examination access code.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const nowMs = now.getTime();
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
          { success: false, error: 'Invalid examination access code.' },
          { status: 404 }
        );
      }
      paper = foundPaper;
    }

    if (!paper) {
      return NextResponse.json(
        { success: false, error: 'Invalid examination access code.' },
        { status: 404 }
      );
    }

    // Schedule Access Window Validation
    if (paper.start_at && nowMs < new Date(paper.start_at).getTime()) {
      return NextResponse.json(
        { success: false, error: 'Exam access has not started yet. Please contact your administrator.' },
        { status: 400 }
      );
    }

    // Check if student has existing IN_PROGRESS attempt
    let existingAttempt: any = null;
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const attempts = Array.from(mockExamStore.attempts.values());
      existingAttempt = attempts.find(
        (a) => a.user_id === auth.profile.id && a.paper_id === paper.id && a.status === 'IN_PROGRESS'
      );
    } else {
      const supabase = createAdminClient();
      const { data: attData } = await supabase
        .from('exam_attempts')
        .select('id, status, expires_at')
        .eq('user_id', auth.profile.id)
        .eq('paper_id', paper.id)
        .eq('status', 'IN_PROGRESS')
        .maybeSingle();
      existingAttempt = attData;
    }

    // If after end_at AND student has NO active attempt -> reject expired code
    if (paper.end_at && nowMs > new Date(paper.end_at).getTime() && !existingAttempt) {
      return NextResponse.json(
        { success: false, error: 'Exam access has closed. The access code has expired. Please contact your administrator.' },
        { status: 400 }
      );
    }

    // Start or recover attempt
    const attemptResult = await createOrRecoverExamAttempt(auth.profile.id, paper.id);

    if (!attemptResult.success || !attemptResult.data) {
      return NextResponse.json(
        { success: false, error: attemptResult.error || 'Failed to initialize exam attempt.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        paperId: paper.id,
        attemptId: attemptResult.data.attemptId,
        status: attemptResult.data.status,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
