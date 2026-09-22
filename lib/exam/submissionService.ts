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

export async function submitExamAttempt(
  userId: string,
  attemptId: string
): Promise<SubmissionResult> {
  const nowIso = new Date().toISOString();
  const supabase = createAdminClient();

  try {
    let attempt: ExamAttempt | null = null;
    let rawAnswers: Answer[] = [];
    let paperQuestions: (PaperQuestion & { questions: Question })[] = [];
    let totalPaperMarks = 50;

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
          marks: 1,
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

    // Status check: Must be IN_PROGRESS
    if (attempt.status !== 'IN_PROGRESS') {
      return {
        success: false,
        error: `Cannot submit attempt: status is already ${attempt.status}`,
        code: `ATTEMPT_${attempt.status}`,
      };
    }

    // 1. Calculate Score Server-Side
    let totalScore = 0;
    const answerMap = new Map<string, Answer>();
    rawAnswers.forEach((a) => answerMap.set(a.question_id, a));

    const perQuestionMark = paperQuestions.length > 0 ? totalPaperMarks / paperQuestions.length : 1;

    paperQuestions.forEach((pq) => {
      const question = pq.questions;
      if (!question) return;

      const studentAns = answerMap.get(question.id);
      // Use equal per-question weighting derived from totalPaperMarks / paperQuestions.length
      const questionMark = perQuestionMark;

      if (studentAns && studentAns.selected_option === question.correct_option) {
        totalScore += Number(questionMark);
        studentAns.is_correct = true;
        studentAns.marks_awarded = questionMark;
      } else if (studentAns) {
        studentAns.is_correct = false;
        studentAns.marks_awarded = 0;
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
