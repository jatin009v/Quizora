import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/exam/paperService';
import { mockExamStore } from '@/lib/exam/service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { paperId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const { paperId } = params;

    if (process.env.NODE_ENV !== 'test' && !isUuid(paperId)) {
      return NextResponse.json({ success: false, error: 'Invalid paper ID format' }, { status: 400 });
    }

    const body = await req.json();
    const {
      question_text,
      question_type = 'MCQ_SINGLE',
      difficulty = 'MEDIUM',
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      code_snippet,
      marks = 1,
    } = body;

    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return NextResponse.json(
        { success: false, error: 'Question text, all 4 options, and correct option are required.' },
        { status: 400 }
      );
    }

    const validOptions = ['A', 'B', 'C', 'D'];
    const normalizedCorrect = String(correct_option).toUpperCase().trim();
    if (!validOptions.includes(normalizedCorrect)) {
      return NextResponse.json(
        { success: false, error: 'Correct option must be A, B, C, or D.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      // Check paper question count limit
      const existingQIds = mockExamStore.paperQuestions.get(paperId) || [];
      const paper = mockExamStore.papers.get(paperId);
      if (paper && existingQIds.length >= paper.required_question_count) {
        return NextResponse.json(
          { success: false, error: `Required question count limit reached (${paper.required_question_count}).` },
          { status: 400 }
        );
      }

      const qId = `pq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newQ = {
        id: qId,
        paper_id: paperId,
        question_id: qId,
        question_order: existingQIds.length + 1,
        question_text,
        question_type,
        difficulty,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option: normalizedCorrect,
        explanation: explanation || null,
        code_snippet: code_snippet || null,
        marks: Number(marks) || 1,
        created_at: nowIso,
        updated_at: nowIso,
      };

      mockExamStore.questions.set(qId, newQ as any);
      existingQIds.push(qId);
      mockExamStore.paperQuestions.set(paperId, existingQIds);

      return NextResponse.json({ success: true, question: newQ }, { status: 201 });
    }

    const supabase = createAdminClient();

    // 1. Fetch paper details & check limit
    const { data: paper, error: paperErr } = await supabase
      .from('papers')
      .select('id, required_question_count, status')
      .eq('id', paperId)
      .maybeSingle();

    if (paperErr || !paper) {
      return NextResponse.json({ success: false, error: 'Examination paper not found.' }, { status: 404 });
    }

    // Check current question count inside paper_questions
    const { count: currentCount } = await supabase
      .from('paper_questions')
      .select('id', { count: 'exact', head: true })
      .eq('paper_id', paperId);

    if (currentCount && currentCount >= paper.required_question_count) {
      return NextResponse.json(
        { success: false, error: `Required question limit reached (${paper.required_question_count} questions).` },
        { status: 400 }
      );
    }

    // 2. Insert paper-specific question snapshot directly into paper_questions
    const newOrder = (currentCount || 0) + 1;
    const { data: newPaperQuestion, error: pqErr } = await supabase
      .from('paper_questions')
      .insert({
        paper_id: paperId,
        question_order: newOrder,
        question_text,
        question_type,
        difficulty,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option: normalizedCorrect,
        explanation: explanation || null,
        code_snippet: code_snippet || null,
        marks: Number(marks) || 1,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (pqErr || !newPaperQuestion) {
      return NextResponse.json({ success: false, error: pqErr?.message || 'Failed to create paper question.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, question: newPaperQuestion }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
