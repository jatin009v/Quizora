import { createAdminClient } from '@/lib/supabase/admin';
import { CreatePaperInput } from '@/lib/validation/paper';
import { Paper, PaperQuestion, Question } from '@/types/database';
import { mockExamStore } from './service';

export interface PaperServiceResult {
  success: boolean;
  error?: string;
  paperId?: string;
  data?: any;
}

export async function createOrUpdatePaperDraft(
  adminProfileId: string,
  input: CreatePaperInput
): Promise<PaperServiceResult> {
  const {
    id: paperIdInput,
    title,
    description,
    course,
    durationMinutes,
    requiredQuestionCount,
    totalMarks,
    markingMode,
    startAt,
    endAt,
    status = 'DRAFT',
    selectedQuestions,
  } = input;

  // 1. Validation: Selected question count must match required question count
  if (selectedQuestions.length !== requiredQuestionCount) {
    return {
      success: false,
      error: `Selected questions count (${selectedQuestions.length}) does not match required questions count (${requiredQuestionCount}).`,
    };
  }

  // 2. Validation: Prevent duplicate question selections
  const questionIds = selectedQuestions.map((q) => q.questionId);
  const uniqueQuestionIds = new Set(questionIds);
  if (uniqueQuestionIds.size !== questionIds.length) {
    return {
      success: false,
      error: 'Duplicate questions detected in paper configuration.',
    };
  }

  // 3. Calculation of per-question marks
  // In EQUAL_MARKS mode: question mark = totalMarks / requiredQuestionCount
  const perQuestionMark = Number((totalMarks / requiredQuestionCount).toFixed(2));

  const nowIso = new Date().toISOString();
  const paperId = paperIdInput || `paper-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Test / Isolated execution handling
  if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
    const paperObj: Paper = {
      id: paperId,
      title,
      description: description || null,
      course,
      duration_minutes: durationMinutes,
      total_marks: totalMarks,
      required_question_count: requiredQuestionCount,
      marking_mode: markingMode,
      status,
      access_code: null,
      start_at: startAt || null,
      end_at: endAt || null,
      created_by: adminProfileId, // STRICT SERVER-SIDE AUTHORIZED CREATOR
      published_at: status === 'PUBLISHED' ? nowIso : null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Store in mock store
    mockExamStore.paperQuestions.set(
      paperId,
      selectedQuestions.map((q) => q.questionId)
    );

    return {
      success: true,
      paperId,
      data: paperObj,
    };
  }

  const supabase = createAdminClient();

  try {
    // Upsert paper with authenticated admin created_by
    const { data: paperData, error: paperError } = await supabase
      .from('papers')
      .upsert({
        id: paperId,
        title,
        description: description || null,
        course,
        duration_minutes: durationMinutes,
        total_marks: totalMarks,
        required_question_count: requiredQuestionCount,
        marking_mode: markingMode,
        status,
        start_at: startAt || null,
        end_at: endAt || null,
        created_by: adminProfileId, // STRICT SERVER-SIDE AUTHORIZED CREATOR
        updated_at: nowIso,
      })
      .select()
      .single();

    if (paperError || !paperData) {
      console.error('Paper upsert error:', paperError);
      return { success: false, error: paperError?.message || 'Failed to save paper draft' };
    }

    // Delete existing paper_questions mapping if updating
    await supabase.from('paper_questions').delete().eq('paper_id', paperId);

    // Insert new ordered paper_questions
    const paperQuestionsToInsert = selectedQuestions.map((sq, idx) => ({
      paper_id: paperId,
      question_id: sq.questionId,
      question_order: sq.questionOrder || idx + 1,
      marks: markingMode === 'EQUAL_MARKS' ? perQuestionMark : sq.marks || perQuestionMark,
    }));

    const { error: pqError } = await supabase
      .from('paper_questions')
      .insert(paperQuestionsToInsert);

    if (pqError) {
      console.error('Paper questions insert error:', pqError);
      return { success: false, error: 'Failed to assign paper questions' };
    }

    return {
      success: true,
      paperId,
      data: paperData,
    };
  } catch (err: any) {
    console.error('Unexpected error in createOrUpdatePaperDraft:', err);
    return { success: false, error: 'Internal server error' };
  }
}

export async function listPapersForAdmin(): Promise<{ success: boolean; papers: Paper[] }> {
  const supabase = createAdminClient();
  try {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      return { success: true, papers: [] };
    }

    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false });

    return { success: true, papers: (data as Paper[]) || [] };
  } catch {
    return { success: false, papers: [] };
  }
}
