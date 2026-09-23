import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/exam/paperService';
import { mockExamStore } from '@/lib/exam/service';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { paperId: string; questionId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const { paperId, questionId } = params;

    if (process.env.NODE_ENV !== 'test' && (!isUuid(paperId) || !isUuid(questionId))) {
      return NextResponse.json({ success: false, error: 'Invalid ID format' }, { status: 400 });
    }

    const body = await req.json();
    const {
      question_text,
      difficulty,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      marks,
    } = body;

    const nowIso = new Date().toISOString();

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const q = mockExamStore.questions.get(questionId);
      if (q) {
        if (question_text) q.question_text = question_text;
        if (difficulty) q.difficulty = difficulty;
        if (option_a) q.option_a = option_a;
        if (option_b) q.option_b = option_b;
        if (option_c) q.option_c = option_c;
        if (option_d) q.option_d = option_d;
        if (correct_option) q.correct_option = correct_option;
        if (explanation !== undefined) q.explanation = explanation;
        if (marks) q.marks = marks;
        q.updated_at = nowIso;
      }
      return NextResponse.json({ success: true, question: q }, { status: 200 });
    }

    const supabase = createAdminClient();

    const updateData: any = { updated_at: nowIso };
    if (question_text) updateData.question_text = question_text;
    if (difficulty) updateData.difficulty = difficulty;
    if (option_a) updateData.option_a = option_a;
    if (option_b) updateData.option_b = option_b;
    if (option_c) updateData.option_c = option_c;
    if (option_d) updateData.option_d = option_d;
    if (correct_option) updateData.correct_option = String(correct_option).toUpperCase().trim();
    if (explanation !== undefined) updateData.explanation = explanation;
    if (marks) updateData.marks = Number(marks);

    // Update in paper_questions scoped to paper_id
    const { data: updatedQ, error } = await supabase
      .from('paper_questions')
      .update(updateData)
      .eq('paper_id', paperId)
      .or(`id.eq.${questionId},question_id.eq.${questionId}`)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, question: updatedQ }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { paperId: string; questionId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const { paperId, questionId } = params;

    if (process.env.NODE_ENV !== 'test' && (!isUuid(paperId) || !isUuid(questionId))) {
      return NextResponse.json({ success: false, error: 'Invalid ID format' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      mockExamStore.questions.delete(questionId);
      const qIds = (mockExamStore.paperQuestions.get(paperId) || []).filter((id) => id !== questionId);
      mockExamStore.paperQuestions.set(paperId, qIds);
      return NextResponse.json({ success: true, message: 'Question removed from paper.' }, { status: 200 });
    }

    const supabase = createAdminClient();

    // Delete question snapshot row from paper_questions scoped to paper_id
    const { error: delErr } = await supabase
      .from('paper_questions')
      .delete()
      .eq('paper_id', paperId)
      .or(`id.eq.${questionId},question_id.eq.${questionId}`);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Question removed from paper.' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
