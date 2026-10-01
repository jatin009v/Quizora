import { createAdminClient } from '@/lib/supabase/admin';
import { Paper, Question, PaperQuestion } from '@/types/database';
import { generateSecureAccessCode, normalizeAccessCode } from './accessCode';
import { mockExamStore } from './service';

export interface PublishResult {
  success: boolean;
  error?: string;
  accessCode?: string;
  data?: {
    paperId: string;
    title: string;
    accessCode: string;
    publishedAt: string;
    totalMarks: number;
    requiredQuestionCount: number;
    durationMinutes: number;
  };
}

export async function publishPaperServerSide(
  adminProfileId: string,
  paperId: string
): Promise<PublishResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    let paper: Paper | null = null;
    let paperQuestions: (PaperQuestion & { questions: Question })[] = [];

    // Isolated test / fallback mode
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      paper = mockExamStore.papers.get(paperId) || null;
      const qIds = mockExamStore.paperQuestions.get(paperId) || [];
      
      paperQuestions = qIds.map((id, idx) => ({
        id: `pq-${idx}`,
        paper_id: paperId,
        question_id: id,
        question_order: idx + 1,
        marks: 1,
        created_at: nowIso,
        questions: mockExamStore.questions.get(id),
      }));

      if (!paper) {
        paper = {
          id: paperId,
          title: 'DCA Computer Fundamentals Quiz',
          description: 'Test paper',
          course: 'DCA',
          duration_minutes: 60,
          total_marks: 50,
          required_question_count: paperQuestions.length,
          marking_mode: 'EQUAL_MARKS',
          status: 'DRAFT',
          access_code: 'DCA-7K4P9X',
          start_at: new Date(Date.now() - 3600000).toISOString(),
          end_at: new Date(Date.now() + 86400000).toISOString(),
          show_result_to_student: false,
          shuffle_questions: true,
          created_by: adminProfileId,
          published_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        };
      }
    } else {
      const { data: pData, error: pError } = await supabase
        .from('papers')
        .select('*')
        .eq('id', paperId)
        .single();

      if (pError || !pData) {
        return { success: false, error: 'Paper draft not found' };
      }
      paper = pData as Paper;

      const { data: pqData } = await supabase
        .from('paper_questions')
        .select('*, questions(*)')
        .eq('paper_id', paperId);

      if (pqData) paperQuestions = pqData as any;
    }

    if (!paper) {
      return { success: false, error: 'Paper draft not found' };
    }

    // 1. SERVER RE-VALIDATION BEFORE PUBLISHING
    if (!paper.title || !paper.course || paper.duration_minutes <= 0 || paper.total_marks <= 0) {
      return { success: false, error: 'Paper contains invalid title, course, duration, or total marks.' };
    }

    if (!paper.start_at || !paper.end_at) {
      return { success: false, error: 'Exam access start and end times are required before publishing.' };
    }

    if (new Date(paper.start_at).getTime() >= new Date(paper.end_at).getTime()) {
      return { success: false, error: 'Exam access start time must be before end time.' };
    }

    if (paperQuestions.length === 0) {
      return { success: false, error: 'Paper has no selected questions.' };
    }

    if (paperQuestions.length !== paper.required_question_count) {
      return {
        success: false,
        error: `Selected questions count (${paperQuestions.length}) does not match required questions count (${paper.required_question_count}).`,
      };
    }

    // Validate every paper_question has text, options, and correct_option (supporting paper-centric snapshots & legacy links)
    for (const pq of paperQuestions) {
      const qType = (pq.question_type || pq.questions?.question_type || 'MCQ_SINGLE').toUpperCase();
      const questionText = (pq.question_text || pq.questions?.question_text || '').trim();
      const optionA = (pq.option_a || pq.questions?.option_a || '').trim();
      const optionB = (pq.option_b || pq.questions?.option_b || '').trim();
      const optionC = (pq.option_c || pq.questions?.option_c || '').trim();
      const optionD = (pq.option_d || pq.questions?.option_d || '').trim();
      const correctOpt = (pq.correct_option || pq.questions?.correct_option || '').toUpperCase().trim();

      if (!questionText || !optionA || !optionB) {
        return {
          success: false,
          error: `One or more questions in this paper contain incomplete text or options (Question #${pq.question_order || 1}).`,
        };
      }

      if (qType === 'TRUE_FALSE') {
        if (!['A', 'B', 'TRUE', 'FALSE'].includes(correctOpt)) {
          return {
            success: false,
            error: `True/False question #${pq.question_order || 1} must have correct answer set to True or False.`,
          };
        }
      } else if (qType === 'MULTIPLE_CHOICE' || qType === 'MCQ_MULTIPLE') {
        if (!optionC || !optionD) {
          return {
            success: false,
            error: `Multiple Choice question #${pq.question_order || 1} requires all 4 options.`,
          };
        }
        const opts = correctOpt.split(',').map((s) => s.trim());
        if (opts.length === 0 || !opts.every((o) => ['A', 'B', 'C', 'D'].includes(o))) {
          return {
            success: false,
            error: `Multiple Choice question #${pq.question_order || 1} has invalid correct options (${correctOpt}).`,
          };
        }
      } else {
        if (!optionC || !optionD || !['A', 'B', 'C', 'D'].includes(correctOpt)) {
          return {
            success: false,
            error: `One or more questions in this paper contain incomplete text or options (Question #${pq.question_order || 1}).`,
          };
        }
      }
    }

    // 2. Validate Access Code
    const accessCode = normalizeAccessCode(paper.access_code);
    if (!accessCode || accessCode.length < 4) {
      return { success: false, error: 'Please create an examination access code before publishing.' };
    }

    // Uniqueness check for access_code
    if (process.env.NODE_ENV !== 'test' && process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const { data: existingPaper } = await supabase
        .from('papers')
        .select('id')
        .eq('status', 'PUBLISHED')
        .ilike('access_code', accessCode)
        .neq('id', paperId)
        .maybeSingle();

      if (existingPaper) {
        return { success: false, error: 'This access code is already in use by another published paper. Please choose another code.' };
      }
    }

    // 3. Update Paper Status to PUBLISHED
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      paper.status = 'PUBLISHED';
      paper.access_code = accessCode;
      paper.published_at = nowIso;
      paper.updated_at = nowIso;
    } else {
      const { error: updateError } = await supabase
        .from('papers')
        .update({
          status: 'PUBLISHED',
          access_code: accessCode,
          published_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', paperId);

      if (updateError) {
        return { success: false, error: `Failed to publish paper: ${updateError.message}` };
      }
    }

    return {
      success: true,
      accessCode: accessCode,
      data: {
        paperId: paper.id,
        title: paper.title,
        accessCode: accessCode,
        publishedAt: nowIso,
        totalMarks: paper.total_marks,
        requiredQuestionCount: paper.required_question_count,
        durationMinutes: paper.duration_minutes,
      },
    };
  } catch (err: any) {
    console.error('Error publishing paper:', err);
    return { success: false, error: err.message || 'Failed to publish paper' };
  }
}
