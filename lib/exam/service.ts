import { createAdminClient } from '@/lib/supabase/admin';
import { SaveAnswerInput, SaveProgressInput } from '@/lib/validation/exam';
import { ClientQuestion, ExamAttempt, Answer } from '@/types/database';

export interface SaveAnswerResult {
  success: boolean;
  error?: string;
  code?: string;
  data?: {
    answerId: string;
    attemptId: string;
    questionId: string;
    selectedOption: string;
    updatedAt: string;
  };
}

export interface ExamStateResult {
  success: boolean;
  error?: string;
  data?: {
    attempt: ExamAttempt;
    questions: ClientQuestion[];
    savedAnswers: Record<string, string>; // questionId -> selectedOption
    remainingSeconds: number;
    lastQuestionIndex: number;
  };
}

// In-Memory Mock Store for isolated unit tests / offline dev execution
export const mockExamStore = {
  attempts: new Map<string, ExamAttempt>(),
  answers: new Map<string, Answer>(), // key: ${attemptId}:${questionId}
  questions: new Map<string, any>(),
  paperQuestions: new Map<string, string[]>(), // paperId -> questionIds[]
};

export async function saveExamAnswer(
  userId: string,
  input: SaveAnswerInput
): Promise<SaveAnswerResult> {
  const { attemptId, questionId, selectedOption, clientTimestamp } = input;
  const nowIso = new Date().toISOString();

  const supabase = createAdminClient();

  try {
    // 1. Fetch attempt and verify ownership
    let attempt: ExamAttempt | null = null;

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      attempt = mockExamStore.attempts.get(attemptId) || null;
    } else {
      const { data, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (!error && data) attempt = data as ExamAttempt;
    }

    if (!attempt) {
      return { success: false, error: 'Exam attempt not found', code: 'ATTEMPT_NOT_FOUND' };
    }

    // 2. Validate attempt ownership
    if (attempt.user_id !== userId) {
      return { success: false, error: 'Unauthorized attempt access', code: 'UNAUTHORIZED_ATTEMPT' };
    }

    // 3. Validate attempt status
    if (attempt.status !== 'IN_PROGRESS') {
      return {
        success: false,
        error: `Cannot modify answer: attempt is ${attempt.status.toLowerCase()}`,
        code: `ATTEMPT_${attempt.status}`,
      };
    }

    // 4. Validate exam expiry
    if (attempt.expires_at && new Date(attempt.expires_at).getTime() < Date.now()) {
      return { success: false, error: 'Exam time has expired', code: 'EXAM_EXPIRED' };
    }

    // 5. Verify question belongs to paper
    let isQuestionInPaper = false;
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const paperQIds = mockExamStore.paperQuestions.get(attempt.paper_id) || [];
      isQuestionInPaper = paperQIds.includes(questionId);
    } else {
      const { data: pq } = await supabase
        .from('paper_questions')
        .select('id')
        .eq('paper_id', attempt.paper_id)
        .eq('question_id', questionId)
        .maybeSingle();
      isQuestionInPaper = !!pq;
    }

    if (!isQuestionInPaper) {
      return { success: false, error: 'Question does not belong to this paper', code: 'INVALID_QUESTION' };
    }

    // 6. Perform Idempotent Upsert (UNIQUE constraint handling)
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const key = `${attemptId}:${questionId}`;
      const existing = mockExamStore.answers.get(key);

      // Rapid answer sequence check: drop if client version is older than existing record
      if (existing && clientTimestamp && new Date(existing.updated_at).getTime() > clientTimestamp) {
        return {
          success: true,
          data: {
            answerId: existing.id,
            attemptId,
            questionId,
            selectedOption: existing.selected_option,
            updatedAt: existing.updated_at,
          },
        };
      }

      const answerId = existing ? existing.id : `ans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const updatedAnswer: Answer = {
        id: answerId,
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption,
        is_correct: null,
        marks_awarded: null,
        answered_at: existing ? existing.answered_at : nowIso,
        updated_at: nowIso,
      };

      mockExamStore.answers.set(key, updatedAnswer);

      return {
        success: true,
        data: {
          answerId,
          attemptId,
          questionId,
          selectedOption,
          updatedAt: nowIso,
        },
      };
    }

    // Supabase DB query
    const { data: upsertData, error: upsertError } = await supabase
      .from('answers')
      .upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_option: selectedOption,
          updated_at: nowIso,
        },
        { onConflict: 'attempt_id,question_id' }
      )
      .select('id, attempt_id, question_id, selected_option, updated_at')
      .single();

    if (upsertError || !upsertData) {
      console.error('Supabase upsert error:', upsertError);
      return { success: false, error: 'Database transaction failed', code: 'DB_ERROR' };
    }

    return {
      success: true,
      data: {
        answerId: upsertData.id,
        attemptId: upsertData.attempt_id,
        questionId: upsertData.question_id,
        selectedOption: upsertData.selected_option,
        updatedAt: upsertData.updated_at,
      },
    };
  } catch (err: any) {
    console.error('Unexpected error in saveExamAnswer:', err);
    return { success: false, error: 'Internal server error', code: 'SERVER_ERROR' };
  }
}

export async function saveExamProgress(
  userId: string,
  input: SaveProgressInput
): Promise<{ success: boolean; error?: string }> {
  const { attemptId, questionIndex } = input;
  const supabase = createAdminClient();

  try {
    let attempt: ExamAttempt | null = null;
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      attempt = mockExamStore.attempts.get(attemptId) || null;
      if (attempt) {
        attempt.last_question_index = questionIndex;
        attempt.updated_at = new Date().toISOString();
        mockExamStore.attempts.set(attemptId, attempt);
        return { success: true };
      }
    } else {
      const { data } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (data) attempt = data as ExamAttempt;
    }

    if (!attempt) return { success: false, error: 'Attempt not found' };
    if (attempt.user_id !== userId) return { success: false, error: 'Unauthorized' };
    if (attempt.status !== 'IN_PROGRESS') return { success: false, error: 'Attempt not active' };

    await supabase
      .from('exam_attempts')
      .update({ last_question_index: questionIndex, updated_at: new Date().toISOString() })
      .eq('id', attemptId);

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Server error' };
  }
}

export async function getExamState(
  userId: string,
  attemptId: string
): Promise<ExamStateResult> {
  const supabase = createAdminClient();

  try {
    let attempt: ExamAttempt | null = null;
    let rawQuestions: any[] = [];
    let savedAnswersList: Answer[] = [];

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      attempt = mockExamStore.attempts.get(attemptId) || null;
      if (attempt) {
        const qIds = mockExamStore.paperQuestions.get(attempt.paper_id) || [];
        rawQuestions = qIds.map((id) => mockExamStore.questions.get(id)).filter(Boolean);
        savedAnswersList = Array.from(mockExamStore.answers.values()).filter(
          (a) => a.attempt_id === attemptId
        );
      }
    } else {
      const { data: attData } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (attData) attempt = attData as ExamAttempt;

      if (attempt) {
        const { data: pqData } = await supabase
          .from('paper_questions')
          .select('question_id, question_order, questions(*)')
          .eq('paper_id', attempt.paper_id)
          .order('question_order', { ascending: true });

        if (pqData) {
          rawQuestions = pqData.map((pq: any) => pq.questions).filter(Boolean);
        }

        const { data: ansData } = await supabase
          .from('answers')
          .select('*')
          .eq('attempt_id', attemptId);
        if (ansData) savedAnswersList = ansData as Answer[];
      }
    }

    if (!attempt) return { success: false, error: 'Attempt not found' };
    if (attempt.user_id !== userId) return { success: false, error: 'Unauthorized attempt access' };

    // SANITIZE QUESTIONS: EXPLICITLY STRIP correct_option AND explanation
    const sanitizedQuestions: ClientQuestion[] = rawQuestions.map((q) => {
      const { correct_option, explanation, ...clientSafe } = q;
      return clientSafe;
    });

    const savedAnswers: Record<string, string> = {};
    savedAnswersList.forEach((a) => {
      savedAnswers[a.question_id] = a.selected_option;
    });

    const remainingSeconds = attempt.expires_at
      ? Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000))
      : 3600;

    return {
      success: true,
      data: {
        attempt,
        questions: sanitizedQuestions,
        savedAnswers,
        remainingSeconds,
        lastQuestionIndex: attempt.last_question_index || 0,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to recover exam state' };
  }
}
