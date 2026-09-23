import { createAdminClient } from '@/lib/supabase/admin';
import { CreatePaperInput } from '@/lib/validation/paper';
import { Paper, PaperQuestion, Question } from '@/types/database';
import { mockExamStore } from './service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(str: string | null | undefined): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

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
    accessCode,
    startAt,
    endAt,
    showResultToStudent = false,
    shuffleQuestions = true,
    status = 'DRAFT',
    selectedQuestions,
  } = input;

  const selectedQuestionsArr = selectedQuestions || [];
  const normalizedAccessCode = accessCode ? accessCode.trim().toUpperCase() : null;

  // Schedule Validation: startAt must be before endAt
  if (startAt && endAt && new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    return {
      success: false,
      error: 'Exam access start time must be before end time.',
    };
  }

  // Check access code uniqueness if provided
  if (normalizedAccessCode) {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      for (const [pId, p] of mockExamStore.papers.entries()) {
        if (pId !== paperIdInput && p.access_code && p.access_code.toUpperCase() === normalizedAccessCode) {
          return {
            success: false,
            error: 'This access code is already in use. Please choose another code.',
          };
        }
      }
    }
  }

  // 1. Validation: PUBLISHED status requires exact required question count; DRAFT allows 0 or partial
  if (status === 'PUBLISHED') {
    if (selectedQuestionsArr.length !== requiredQuestionCount) {
      return {
        success: false,
        error: `Cannot publish paper: selected questions count (${selectedQuestionsArr.length}) does not match required questions count (${requiredQuestionCount}).`,
      };
    }
  } else {
    if (selectedQuestionsArr.length > requiredQuestionCount) {
      return {
        success: false,
        error: `Selected questions count (${selectedQuestionsArr.length}) exceeds required questions count (${requiredQuestionCount}).`,
      };
    }
  }

  // 2. Validation: Prevent duplicate question selections
  const questionIds = selectedQuestionsArr.map((q) => q.questionId);
  const uniqueQuestionIds = new Set(questionIds);
  if (uniqueQuestionIds.size !== questionIds.length) {
    return {
      success: false,
      error: 'Duplicate questions detected in paper configuration.',
    };
  }

  // 3. Calculation of per-question marks
  const perQuestionMark = requiredQuestionCount > 0 ? Number((totalMarks / requiredQuestionCount).toFixed(2)) : 1;

  const nowIso = new Date().toISOString();
  const isUpdating = isUuid(paperIdInput);

  // Test / Isolated execution handling
  if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
    const paperId = paperIdInput || crypto.randomUUID();
    const paperObj: Paper = {
      id: paperId,
      title,
      description: description || null,
      course,
      duration_minutes: durationMinutes,
      total_marks: totalMarks,
      required_question_count: requiredQuestionCount,
      marking_mode: markingMode || 'EQUAL_MARKS',
      status: status || 'DRAFT',
      access_code: normalizedAccessCode,
      start_at: startAt || null,
      end_at: endAt || null,
      show_result_to_student: showResultToStudent,
      shuffle_questions: shuffleQuestions,
      created_by: adminProfileId, // STRICT SERVER-SIDE AUTHORIZED CREATOR
      published_at: status === 'PUBLISHED' ? nowIso : null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Store in mock store
    mockExamStore.papers.set(paperId, paperObj);
    mockExamStore.paperQuestions.set(
      paperId,
      selectedQuestionsArr.map((q) => q.questionId)
    );

    return {
      success: true,
      paperId,
      data: paperObj,
    };
  }

  const supabase = createAdminClient();

  try {
    let paperData: any = null;
    let paperError: any = null;

    if (isUpdating) {
      // Upsert existing paper row with validated UUID
      const res = await supabase
        .from('papers')
        .upsert({
          id: paperIdInput!,
          title,
          description: description || null,
          course,
          duration_minutes: durationMinutes,
          total_marks: totalMarks,
          required_question_count: requiredQuestionCount,
          marking_mode: markingMode,
          status,
          access_code: normalizedAccessCode,
          start_at: startAt || null,
          end_at: endAt || null,
          show_result_to_student: showResultToStudent,
          shuffle_questions: shuffleQuestions,
          created_by: adminProfileId,
          updated_at: nowIso,
        })
        .select()
        .single();
      paperData = res.data;
      paperError = res.error;
    } else {
      // Insert new paper row without passing id (Postgres automatically assigns gen_random_uuid())
      const res = await supabase
        .from('papers')
        .insert({
          title,
          description: description || null,
          course,
          duration_minutes: durationMinutes,
          total_marks: totalMarks,
          required_question_count: requiredQuestionCount,
          marking_mode: markingMode,
          status,
          access_code: normalizedAccessCode,
          start_at: startAt || null,
          end_at: endAt || null,
          show_result_to_student: showResultToStudent,
          shuffle_questions: shuffleQuestions,
          created_by: adminProfileId,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select()
        .single();
      paperData = res.data;
      paperError = res.error;
    }

    if (paperError || !paperData) {
      console.error('Paper save error:', paperError);
      return { success: false, error: paperError?.message || 'Failed to save paper draft' };
    }

    const realPaperId = paperData.id;

    // Delete existing paper_questions mapping if updating
    await supabase.from('paper_questions').delete().eq('paper_id', realPaperId);

    // Insert new ordered paper_questions if any exist
    if (selectedQuestionsArr.length > 0) {
      const paperQuestionsToInsert = selectedQuestionsArr.map((sq, idx) => ({
        paper_id: realPaperId,
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
    }

    return {
      success: true,
      paperId: realPaperId,
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
      return { success: true, papers: Array.from(mockExamStore.papers.values()) };
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

export async function deletePaper(
  adminProfileId: string,
  paperId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const attempts = Array.from(mockExamStore.attempts.values()).filter((a) => a.paper_id === paperId);
      const hasActive = attempts.some((a) => a.status === 'IN_PROGRESS');
      if (hasActive) {
        return {
          success: false,
          error: 'This exam currently has active attempts and cannot be deleted while students are taking it.',
        };
      }

      attempts.forEach((a) => {
        mockExamStore.attempts.delete(a.id);
        mockExamStore.answers.delete(a.id);
      });
      mockExamStore.paperQuestions.delete(paperId);
      mockExamStore.papers.delete(paperId);

      return { success: true };
    }

    if (!isUuid(paperId)) {
      return { success: false, error: 'Invalid paper ID reference.' };
    }

    // 1. Verify paper exists
    const { data: paper, error: paperErr } = await supabase
      .from('papers')
      .select('id, title, status')
      .eq('id', paperId)
      .maybeSingle();

    if (paperErr || !paper) {
      return { success: false, error: 'Examination paper not found.' };
    }

    // 2. Check for active IN_PROGRESS attempts
    const { count: activeCount } = await supabase
      .from('exam_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('paper_id', paperId)
      .eq('status', 'IN_PROGRESS');

    if (activeCount && activeCount > 0) {
      return {
        success: false,
        error: 'This exam currently has active attempts and cannot be deleted while students are taking it.',
      };
    }

    // 3. Fetch all attempt IDs for this paper
    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('paper_id', paperId);

    const attemptIds = (attempts || []).map((a) => a.id);

    if (attemptIds.length > 0) {
      await supabase.from('answers').delete().in('attempt_id', attemptIds);
      await supabase.from('proctor_events').delete().in('attempt_id', attemptIds);
      await supabase.from('exam_attempts').delete().eq('paper_id', paperId);
    }

    // 4. Delete paper_questions linkage rows ONLY (DO NOT delete questions from questions table!)
    await supabase.from('paper_questions').delete().eq('paper_id', paperId);

    // 5. Delete paper record
    const { error: deleteErr } = await supabase.from('papers').delete().eq('id', paperId);

    if (deleteErr) {
      return { success: false, error: `Failed to delete paper: ${deleteErr.message}` };
    }

    // 6. Audit Log
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminProfileId,
      action: 'PAPER_DELETED',
      target_type: 'PAPER',
      target_id: paperId,
      metadata: { title: paper.title, status: paper.status },
      created_at: nowIso,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error deleting paper:', err);
    return { success: false, error: err.message || 'Failed to delete paper' };
  }
}
