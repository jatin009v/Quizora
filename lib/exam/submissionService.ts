import { createAdminClient } from '@/lib/supabase/admin';
import { ExamAttempt, Answer, Question, PaperQuestion } from '@/types/database';
import { mockExamStore } from './service';

export interface SubmissionResult {
  success: boolean;
  error?: string;
  code?: string;
  data?: {
    attemptId: string;
    score: number;
    totalMarks: number;
    percentage: number;
    submittedAt: string;
    completionTimeSeconds: number;
  };
}

function normalizeOption(opt: string | null | undefined): string {
  if (!opt) return '';
  const v = opt.trim().toUpperCase();
  if (v === 'OPTION_A' || v === 'A') return 'A';
  if (v === 'OPTION_B' || v === 'B') return 'B';
  if (v === 'OPTION_C' || v === 'C') return 'C';
  if (v === 'OPTION_D' || v === 'D') return 'D';
  return v;
}

export async function submitExamAttempt(
  userId: string,
  attemptId: string,
  unconfirmedAnswers?: Record<string, string>
): Promise<SubmissionResult> {
  const nowIso = new Date().toISOString();
  const supabase = createAdminClient();

  try {
    let attempt: ExamAttempt | null = null;
    let rawAnswers: Answer[] = [];
    let paperQuestions: (PaperQuestion & { questions: Question })[] = [];
    let totalPaperMarks = 50;

    // Server-Side Reconciliation: Upsert any unconfirmed client answers before reading for grading
    if (unconfirmedAnswers && Object.keys(unconfirmedAnswers).length > 0) {
      for (const [qId, opt] of Object.entries(unconfirmedAnswers)) {
        if (!opt) continue;
        if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
          const key = `${attemptId}:${qId}`;
          if (!mockExamStore.answers.has(key)) {
            mockExamStore.answers.set(key, {
              id: `ans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              attempt_id: attemptId,
              question_id: qId,
              selected_option: opt,
              is_correct: null,
              marks_awarded: null,
              answered_at: nowIso,
              updated_at: nowIso,
            });
          }
        } else {
          await supabase.from('answers').upsert(
            {
              attempt_id: attemptId,
              question_id: qId,
              selected_option: opt,
              updated_at: nowIso,
            },
            { onConflict: 'attempt_id,question_id' }
          );
        }
      }
    }

    // Isolated test / fallback handling
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      attempt = mockExamStore.attempts.get(attemptId) || null;
      if (attempt) {
        rawAnswers = Array.from(mockExamStore.answers.values()).filter(
          (a) => a.attempt_id === attemptId
        );
        const qIds = mockExamStore.paperQuestions.get(attempt.paper_id) || [];
        paperQuestions = qIds.map((qId, idx) => ({
          id: `pq-${idx}`,
          paper_id: attempt!.paper_id,
          question_id: qId,
          question_order: idx + 1,
          marks: (mockExamStore.questions.get(qId)?.marks) || 1,
          created_at: nowIso,
          questions: mockExamStore.questions.get(qId),
        }));
        totalPaperMarks = attempt.total_marks || 50;
      }
    } else {
      const { data: attData } = await supabase
        .from('exam_attempts')
        .select('*, papers(total_marks)')
        .eq('id', attemptId)
        .single();

      if (attData) {
        attempt = attData as any;
        totalPaperMarks = attData.papers?.total_marks || attData.total_marks || 50;
      }

      if (attempt) {
        const { data: ansData } = await supabase
          .from('answers')
          .select('*')
          .eq('attempt_id', attemptId);
        if (ansData) rawAnswers = ansData as Answer[];

        const { data: pqData } = await supabase
          .from('paper_questions')
          .select('*, questions(*)')
          .eq('paper_id', attempt.paper_id);
        if (pqData) paperQuestions = pqData as any;
      }
    }

    if (!attempt) {
      return { success: false, error: 'Exam attempt not found', code: 'ATTEMPT_NOT_FOUND' };
    }

    // Authorization: Attempt owner check
    if (attempt.user_id !== userId) {
      return { success: false, error: 'Unauthorized attempt submission', code: 'UNAUTHORIZED_ATTEMPT' };
    }

    // Idempotency: If attempt is already SUBMITTED, return existing score & metadata safely
    if (attempt.status === 'SUBMITTED') {
      const score = Number(attempt.score || 0);
      const totalMarks = attempt.total_marks || totalPaperMarks;
      const percentage = Number(((score / totalMarks) * 100).toFixed(2));
      return {
        success: true,
        data: {
          attemptId,
          score,
          totalMarks,
          percentage,
          submittedAt: attempt.submitted_at || nowIso,
          completionTimeSeconds: 0,
        },
      };
    }

    // Status check: Allow IN_PROGRESS and LOCKED attempts to finalize safely
    if (attempt.status !== 'IN_PROGRESS' && attempt.status !== 'LOCKED') {
      return {
        success: false,
        error: `Cannot submit attempt: status is ${attempt.status.toLowerCase()}`,
        code: `ATTEMPT_${attempt.status}`,
      };
    }

    // 1. Calculate Score Server-Side
    let totalScore = 0;
    const answerMap = new Map<string, Answer>();
    rawAnswers.forEach((a) => {
      answerMap.set(a.question_id, a);
      if (a.id) answerMap.set(a.id, a);
    });

    const perQuestionMark = paperQuestions.length > 0 ? totalPaperMarks / paperQuestions.length : 1;

    paperQuestions.forEach((pq: any) => {
      const qId = pq.question_id || pq.id;
      const correctOption = pq.correct_option || pq.questions?.correct_option;
      if (!correctOption) return;

      const studentAns = answerMap.get(qId) || (pq.id ? answerMap.get(pq.id) : undefined);
      const questionMark = (totalPaperMarks && paperQuestions.length > 0)
        ? (totalPaperMarks / paperQuestions.length)
        : (pq.questions?.marks || pq.marks || 1);

      if (studentAns) {
        const isMatch = normalizeOption(studentAns.selected_option) === normalizeOption(correctOption);
        if (isMatch) {
          totalScore += Number(questionMark);
          studentAns.is_correct = true;
          studentAns.marks_awarded = questionMark;
        } else {
          studentAns.is_correct = false;
          studentAns.marks_awarded = 0;
        }
      }
    });

    totalScore = Number(totalScore.toFixed(2));
    const percentage = Number(((totalScore / totalPaperMarks) * 100).toFixed(2));

    // 2. Server Completion Time Calculation
    const startedTime = attempt.started_at ? new Date(attempt.started_at).getTime() : Date.now();
    const completionTimeSeconds = Math.max(0, Math.floor((Date.now() - startedTime) / 1000));

    // 3. Persist Final Score & Status (SUBMITTED)
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      attempt.status = 'SUBMITTED';
      attempt.submitted_at = nowIso;
      attempt.score = totalScore;
      attempt.total_marks = totalPaperMarks;
      attempt.updated_at = nowIso;
      mockExamStore.attempts.set(attemptId, attempt);
    } else {
      await supabase
        .from('exam_attempts')
        .update({
          status: 'SUBMITTED',
          submitted_at: nowIso,
          score: totalScore,
          total_marks: totalPaperMarks,
          updated_at: nowIso,
        })
        .eq('id', attemptId);

      // Update individual answer correctness records
      for (const ans of rawAnswers) {
        if (ans.is_correct !== undefined) {
          await supabase
            .from('answers')
            .update({
              is_correct: ans.is_correct,
              marks_awarded: ans.marks_awarded,
              updated_at: nowIso,
            })
            .eq('id', ans.id);
        }
      }
    }

    return {
      success: true,
      data: {
        attemptId,
        score: totalScore,
        totalMarks: totalPaperMarks,
        percentage,
        submittedAt: nowIso,
        completionTimeSeconds,
      },
    };
  } catch (err: any) {
    console.error('Submission error:', err);
    return { success: false, error: 'Internal server error' };
  }
}
