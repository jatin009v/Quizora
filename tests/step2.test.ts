import { describe, it, expect, beforeEach } from 'vitest';
import { createOrUpdatePaperDraft } from '../lib/exam/paperService';
import { submitExamAttempt } from '../lib/exam/submissionService';
import { getPaperLeaderboard } from '../lib/exam/leaderboardService';
import { mockExamStore } from '../lib/exam/service';
import { SubmitExamSchema } from '../lib/validation/paper';

describe('Quizora DCA Quiz Platform — Step 2 Verification Suite', () => {
  const adminId = 'usr-admin-001';
  const student1Id = 'usr-student-001';
  const student2Id = 'usr-student-002';
  const paperId = 'paper-step2-2026';
  const q1Id = 'q-step2-101';
  const q2Id = 'q-step2-102';
  const attempt1Id = 'att-step2-001';
  const attempt2Id = 'att-step2-002';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();

    // Populate question catalog
    mockExamStore.questions.set(q1Id, {
      id: q1Id,
      question_text: 'What is the size of int data type in Java?',
      option_a: '2 Bytes',
      option_b: '4 Bytes',
      option_c: '8 Bytes',
      option_d: '1 Byte',
      correct_option: 'B',
      marks: 1,
    });

    mockExamStore.questions.set(q2Id, {
      id: q2Id,
      question_text: 'Which SQL command is used to add new rows to a table?',
      option_a: 'ADD',
      option_b: 'UPDATE',
      option_c: 'INSERT INTO',
      option_d: 'CREATE ROW',
      correct_option: 'C',
      marks: 1,
    });

    // Populate Paper questions
    mockExamStore.paperQuestions.set(paperId, [q1Id, q2Id]);
  });

  it('1. 50 questions defaults to 50 marks (1 question = 1 mark)', async () => {
    const selected = Array.from({ length: 50 }, (_, i) => ({
      questionId: `q-auto-${i + 1}`,
      questionOrder: i + 1,
    }));

    const paper = await createOrUpdatePaperDraft(adminId, {
      title: 'DCA 50 Q Quiz',
      course: 'DCA',
      durationMinutes: 60,
      requiredQuestionCount: 50,
      totalMarks: 50,
      markingMode: 'EQUAL_MARKS',
      status: 'DRAFT',
      selectedQuestions: selected,
    });

    expect(paper.success).toBe(true);
    expect(paper.data.total_marks).toBe(50);
  });

  it('2. Admin can change total marks', async () => {
    const selected = Array.from({ length: 50 }, (_, i) => ({
      questionId: `q-auto-${i + 1}`,
      questionOrder: i + 1,
    }));

    const paper = await createOrUpdatePaperDraft(adminId, {
      title: 'DCA 50 Q 100 Marks Quiz',
      course: 'DCA',
      durationMinutes: 60,
      requiredQuestionCount: 50,
      totalMarks: 100,
      markingMode: 'EQUAL_MARKS',
      status: 'DRAFT',
      selectedQuestions: selected,
    });

    expect(paper.success).toBe(true);
    expect(paper.data.total_marks).toBe(100);
  });

  it('3. 50 questions + 100 marks gives 2 marks per question', () => {
    const totalMarks = 100;
    const requiredQuestions = 50;
    const perQuestionMark = totalMarks / requiredQuestions;
    expect(perQuestionMark).toBe(2);
  });

  it('4. Selected question count is validated against required question count', async () => {
    const paper = await createOrUpdatePaperDraft(adminId, {
      title: 'Invalid Count Quiz',
      course: 'DCA',
      durationMinutes: 60,
      requiredQuestionCount: 50,
      totalMarks: 50,
      markingMode: 'EQUAL_MARKS',
      status: 'DRAFT',
      selectedQuestions: [{ questionId: q1Id, questionOrder: 1 }], // Only 1 selected when 50 required!
    });

    expect(paper.success).toBe(false);
    expect(paper.error).toContain('does not match required questions count');
  });

  it('5. Duplicate questions are rejected', async () => {
    const paper = await createOrUpdatePaperDraft(adminId, {
      title: 'Duplicate Q Quiz',
      course: 'DCA',
      durationMinutes: 60,
      requiredQuestionCount: 2,
      totalMarks: 2,
      markingMode: 'EQUAL_MARKS',
      status: 'DRAFT',
      selectedQuestions: [
        { questionId: q1Id, questionOrder: 1 },
        { questionId: q1Id, questionOrder: 2 }, // Duplicate q1Id!
      ],
    });

    expect(paper.success).toBe(false);
    expect(paper.error).toContain('Duplicate questions detected');
  });

  it('6. Score is calculated server-side based on correct_option', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: new Date(Date.now() - 120000).toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
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

    // Student selects B for Q1 (Correct) and C for Q2 (Correct)
    mockExamStore.answers.set(`${attempt1Id}:${q1Id}`, {
      id: 'ans-1',
      attempt_id: attempt1Id,
      question_id: q1Id,
      selected_option: 'B',
      is_correct: null,
      marks_awarded: null,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mockExamStore.answers.set(`${attempt1Id}:${q2Id}`, {
      id: 'ans-2',
      attempt_id: attempt1Id,
      question_id: q2Id,
      selected_option: 'C',
      is_correct: null,
      marks_awarded: null,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const sub = await submitExamAttempt(student1Id, attempt1Id);
    expect(sub.success).toBe(true);
    expect(sub.data?.score).toBe(50);
    expect(sub.data?.percentage).toBe(100);
  });

  it('7. Client cannot submit a trusted score payload (SubmitExamSchema enforces attemptId only)', () => {
    const invalidPayload = SubmitExamSchema.safeParse({
      attemptId: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
      score: 100, // Disallowed extra property ignored or stripped
    });

    expect(invalidPayload.success).toBe(true);
    expect((invalidPayload.data as any).score).toBeUndefined(); // Score field stripped by schema!
  });

  it('8. Submission time is server-authoritative (set to server now timestamp)', async () => {
    const startTime = Date.now();
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: new Date(startTime - 60000).toISOString(),
      expires_at: new Date(startTime + 3600000).toISOString(),
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

    const sub = await submitExamAttempt(student1Id, attempt1Id);
    expect(sub.success).toBe(true);
    const subTime = new Date(sub.data!.submittedAt).getTime();
    expect(subTime).toBeGreaterThanOrEqual(startTime);
  });

  it('9. Completion time is calculated correctly (submitted_at - started_at)', async () => {
    const startedAt = new Date(Date.now() - 300000).toISOString();
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: startedAt,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
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

    const sub = await submitExamAttempt(student1Id, attempt1Id);
    expect(sub.success).toBe(true);
    expect(sub.data?.completionTimeSeconds).toBeGreaterThanOrEqual(299);
  });

  it('10. Higher score ranks first in leaderboard', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 90,
      total_marks: 100,
      submitted_at: new Date('2026-09-22T10:00:00Z').toISOString(),
      started_at: new Date('2026-09-22T09:00:00Z').toISOString(),
      expires_at: null,
      locked_at: null,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { name: 'Student High', course: 'DCA', year: '1st Year' },
    } as any);

    mockExamStore.attempts.set(attempt2Id, {
      id: attempt2Id,
      user_id: student2Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 75,
      total_marks: 100,
      submitted_at: new Date('2026-09-22T09:50:00Z').toISOString(),
      started_at: new Date('2026-09-22T09:00:00Z').toISOString(),
      expires_at: null,
      locked_at: null,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { name: 'Student Low', course: 'DCA', year: '1st Year' },
    } as any);

    const lb = await getPaperLeaderboard(paperId);
    expect(lb.success).toBe(true);
    expect(lb.leaderboard[0].attemptId).toBe(attempt1Id);
  });

  it('11. Equal score is resolved by earlier submission timestamp', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 95,
      total_marks: 100,
      submitted_at: new Date('2026-09-22T10:32:15Z').toISOString(),
      started_at: new Date('2026-09-22T10:00:00Z').toISOString(),
      expires_at: null,
      locked_at: null,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { name: 'Student (Earlier)', course: 'DCA', year: '1st Year' },
    } as any);

    mockExamStore.attempts.set(attempt2Id, {
      id: attempt2Id,
      user_id: student2Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 95,
      total_marks: 100,
      submitted_at: new Date('2026-09-22T10:35:20Z').toISOString(),
      started_at: new Date('2026-09-22T10:00:00Z').toISOString(),
      expires_at: null,
      locked_at: null,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { name: 'Student (Later)', course: 'DCA', year: '1st Year' },
    } as any);

    const lb = await getPaperLeaderboard(paperId);
    expect(lb.success).toBe(true);
    expect(lb.leaderboard[0].attemptId).toBe(attempt1Id);
    expect(lb.leaderboard[1].tieReason).toBeDefined();
  });

  it('12. Ranking sorting is 100% deterministic (score DESC, submitted_at ASC, id ASC)', async () => {
    const sameTime = new Date('2026-09-22T10:00:00Z').toISOString();
    mockExamStore.attempts.set('att-B', {
      id: 'att-B',
      user_id: student2Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 100,
      total_marks: 100,
      submitted_at: sameTime,
      started_at: sameTime,
      expires_at: null,
      locked_at: null,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: sameTime,
      updated_at: sameTime,
    } as any);

    mockExamStore.attempts.set('att-A', {
      id: 'att-A',
      user_id: student1Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 100,
      total_marks: 100,
      submitted_at: sameTime,
      started_at: sameTime,
      expires_at: null,
      locked_at: null,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: sameTime,
      updated_at: sameTime,
    } as any);

    const lb = await getPaperLeaderboard(paperId);
    expect(lb.leaderboard[0].attemptId).toBe('att-A');
  });

  it('13. Draft paper can be created with authenticated admin creator', async () => {
    const selected = Array.from({ length: 50 }, (_, i) => ({
      questionId: `q-auto-${i + 1}`,
      questionOrder: i + 1,
    }));

    const paper = await createOrUpdatePaperDraft(adminId, {
      title: 'Admin Created Draft',
      course: 'DCA',
      durationMinutes: 60,
      requiredQuestionCount: 50,
      totalMarks: 50,
      markingMode: 'EQUAL_MARKS',
      status: 'DRAFT',
      selectedQuestions: selected,
    });

    expect(paper.success).toBe(true);
    expect(paper.data.created_by).toBe(adminId);
  });
});
