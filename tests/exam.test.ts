import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveExamAnswer,
  saveExamProgress,
  getExamState,
  mockExamStore,
} from '../lib/exam/service';
import { SaveAnswerSchema } from '../lib/validation/exam';

describe('Quizora DCA Exam Architecture — Step 1 Verification Suite', () => {
  const student1Id = 'usr-student-001';
  const student2Id = 'usr-student-002';
  const paperId = 'paper-dca-2026';
  const question1Id = 'q-101-uuid-0001';
  const question2Id = 'q-102-uuid-0002';
  const invalidQuestionId = 'q-invalid-uuid';
  const attempt1Id = 'att-001-uuid-0001';
  const lockedAttemptId = 'att-locked-0001';
  const submittedAttemptId = 'att-submitted-001';

  beforeEach(() => {
    // Reset mock store before each test run
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();

    // Populate question catalog
    mockExamStore.questions.set(question1Id, {
      id: question1Id,
      question_text: 'What is the time complexity of binary search?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      option_a: 'O(n)',
      option_b: 'O(log n)',
      option_c: 'O(n^2)',
      option_d: 'O(1)',
      correct_option: 'B', // SENSITIVE DATA
      explanation: 'Binary search halves search space each iteration.',
      marks: 2,
    });

    mockExamStore.questions.set(question2Id, {
      id: question2Id,
      question_text: 'Which SQL keyword removes table definitions?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      option_a: 'DELETE',
      option_b: 'TRUNCATE',
      option_c: 'DROP',
      option_d: 'REMOVE',
      correct_option: 'C',
      explanation: 'DROP TABLE removes both structure and data.',
      marks: 1,
    });

    mockExamStore.paperQuestions.set(paperId, [question1Id, question2Id]);

    // Active Attempt for Student 1
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      submitted_at: null,
      locked_at: null,
      score: null,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Locked Attempt
    mockExamStore.attempts.set(lockedAttemptId, {
      id: lockedAttemptId,
      user_id: student1Id,
      paper_id: paperId,
      status: 'LOCKED',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      submitted_at: null,
      locked_at: new Date().toISOString(),
      score: null,
      total_marks: 50,
      tab_switch_count: 3,
      fullscreen_exit_count: 2,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Submitted Attempt
    mockExamStore.attempts.set(submittedAttemptId, {
      id: submittedAttemptId,
      user_id: student1Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      submitted_at: new Date().toISOString(),
      locked_at: null,
      score: 48,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('1. Answer can be saved immediately', async () => {
    const res = await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'B',
    });

    expect(res.success).toBe(true);
    expect(res.data?.selectedOption).toBe('B');
  });

  it('2. Answer can be changed (A -> B -> C)', async () => {
    await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'A',
    });

    const updateRes = await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'C',
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.selectedOption).toBe('C');
  });

  it('3. Only one answer row exists per attempt and question', async () => {
    await saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question1Id, selectedOption: 'A' });
    await saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question1Id, selectedOption: 'B' });
    await saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question1Id, selectedOption: 'C' });

    const totalAnswers = Array.from(mockExamStore.answers.values()).filter(
      (a) => a.attempt_id === attempt1Id && a.question_id === question1Id
    );

    expect(totalAnswers.length).toBe(1);
    expect(totalAnswers[0].selected_option).toBe('C');
  });

  it('4. Refresh recovers saved answers correctly', async () => {
    await saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question1Id, selectedOption: 'B' });
    await saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question2Id, selectedOption: 'C' });

    const state = await getExamState(student1Id, attempt1Id);
    expect(state.success).toBe(true);
    expect(state.data?.savedAnswers[question1Id]).toBe('B');
    expect(state.data?.savedAnswers[question2Id]).toBe('C');
  });

  it('5. Current question index is persisted and recovered', async () => {
    await saveExamProgress(student1Id, { attemptId: attempt1Id, questionIndex: 27 });

    const state = await getExamState(student1Id, attempt1Id);
    expect(state.success).toBe(true);
    expect(state.data?.lastQuestionIndex).toBe(27);
  });

  it('6. Unauthorized user cannot modify another student attempt', async () => {
    const res = await saveExamAnswer(student2Id, {
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'B',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED_ATTEMPT');
  });

  it('7. Locked attempt cannot be modified', async () => {
    const res = await saveExamAnswer(student1Id, {
      attemptId: lockedAttemptId,
      questionId: question1Id,
      selectedOption: 'B',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('ATTEMPT_LOCKED');
  });

  it('8. Submitted attempt cannot be modified', async () => {
    const res = await saveExamAnswer(student1Id, {
      attemptId: submittedAttemptId,
      questionId: question1Id,
      selectedOption: 'B',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('ATTEMPT_SUBMITTED');
  });

  it('9. Question not belonging to paper is rejected', async () => {
    const res = await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: 'q-999-not-in-paper',
      selectedOption: 'A',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('INVALID_QUESTION');
  });

  it('10. Correct answer is NEVER returned to student state payload', async () => {
    const state = await getExamState(student1Id, attempt1Id);
    expect(state.success).toBe(true);
    const questions = state.data?.questions || [];

    questions.forEach((q: any) => {
      expect(q.correct_option).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    });
  });

  it('11. Duplicate answer requests do not create duplicate rows', async () => {
    const req1 = saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question1Id, selectedOption: 'B' });
    const req2 = saveExamAnswer(student1Id, { attemptId: attempt1Id, questionId: question1Id, selectedOption: 'B' });

    await Promise.all([req1, req2]);

    const answersList = Array.from(mockExamStore.answers.values()).filter(
      (a) => a.attempt_id === attempt1Id && a.question_id === question1Id
    );
    expect(answersList.length).toBe(1);
  });

  it('12. Rapid out-of-order answer changes resolve to latest timestamp', async () => {
    // Newer request arrives first
    await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'C',
      clientTimestamp: 2000,
    });

    // Older delayed request arrives later
    await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'A',
      clientTimestamp: 1000,
    });

    const answersList = Array.from(mockExamStore.answers.values()).filter(
      (a) => a.attempt_id === attempt1Id && a.question_id === question1Id
    );
    expect(answersList[0].selected_option).toBe('C');
  });

  it('13. Zod schema strictly validates input options', () => {
    const invalidOption = SaveAnswerSchema.safeParse({
      attemptId: attempt1Id,
      questionId: question1Id,
      selectedOption: 'X', // Invalid
    });

    expect(invalidOption.success).toBe(false);
  });
});
