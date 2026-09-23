import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrUpdatePaperDraft, deletePaper, isUuid } from '../lib/exam/paperService';
import { publishPaperServerSide } from '../lib/exam/publishService';
import { validateAccessCodeServerSide, createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { getExamState, mockExamStore } from '../lib/exam/service';
import { CreatePaperSchema } from '../lib/validation/paper';

describe('Quizora Step 11 — Exam Control Features Suite', () => {
  const adminId = 'usr-admin-step11';
  const student1Id = 'usr-student1-step11';
  const student2Id = 'usr-student2-step11';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.questions.clear();
    mockExamStore.papers.clear();

    // Populate mock question bank
    for (let i = 1; i <= 5; i++) {
      const qId = `q-step11-00${i}`;
      mockExamStore.questions.set(qId, {
        id: qId,
        question_text: `Question ${i} text?`,
        question_type: 'MCQ_SINGLE',
        difficulty: 'EASY',
        option_a: 'Opt A',
        option_b: 'Opt B',
        option_c: 'Opt C',
        option_d: 'Opt D',
        correct_option: 'A',
        marks: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  describe('1. Feature 2 — Result Visibility Control', () => {
    it('creates paper draft with showResultToStudent = false by default', async () => {
      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Step 11 Quiz',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 5,
        markingMode: 'EQUAL_MARKS',
        showResultToStudent: false,
        shuffleQuestions: true,
        selectedQuestions: [1, 2, 3, 4, 5].map((idx) => ({
          questionId: `q-step11-00${idx}`,
          questionOrder: idx,
        })),
      });

      expect(result.success).toBe(true);
      expect(result.data.show_result_to_student).toBe(false);
    });

    it('allows toggle of showResultToStudent = true', async () => {
      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Step 11 Quiz Visible',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 5,
        markingMode: 'EQUAL_MARKS',
        showResultToStudent: true,
        shuffleQuestions: true,
        selectedQuestions: [1, 2, 3, 4, 5].map((idx) => ({
          questionId: `q-step11-00${idx}`,
          questionOrder: idx,
        })),
      });

      expect(result.success).toBe(true);
      expect(result.data.show_result_to_student).toBe(true);
    });
  });

  describe('2. Feature 3 — Exam Access Date/Time Window', () => {
    it('rejects paper draft creation when startAt >= endAt', async () => {
      const now = new Date();
      const futureStart = new Date(now.getTime() + 7200000).toISOString(); // +2 hrs
      const pastEnd = new Date(now.getTime() + 3600000).toISOString(); // +1 hr

      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Invalid Schedule Paper',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 5,
        markingMode: 'EQUAL_MARKS',
        startAt: futureStart,
        endAt: pastEnd,
        selectedQuestions: [1, 2, 3, 4, 5].map((idx) => ({
          questionId: `q-step11-00${idx}`,
          questionOrder: idx,
        })),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('start time must be before end time');
    });

    it('zod schema validation fails when startAt >= endAt', () => {
      const now = new Date();
      const futureStart = new Date(now.getTime() + 7200000).toISOString();
      const pastEnd = new Date(now.getTime() + 3600000).toISOString();

      const parseRes = CreatePaperSchema.safeParse({
        title: 'Invalid Schedule Paper',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 5,
        markingMode: 'EQUAL_MARKS',
        startAt: futureStart,
        endAt: pastEnd,
        selectedQuestions: [1, 2, 3, 4, 5].map((idx) => ({
          questionId: `00000000-0000-0000-0000-00000000000${idx}`,
          questionOrder: idx,
        })),
      });

      expect(parseRes.success).toBe(false);
    });
  });

  describe('3. Feature 4 — Question Order Shuffling & Persistence', () => {
    it('persists shuffled question order per attempt and keeps order stable', async () => {
      const paperId = '00000000-0000-0000-0000-000000000099';
      const questionIds = ['q-step11-001', 'q-step11-002', 'q-step11-003', 'q-step11-004', 'q-step11-005'];
      mockExamStore.paperQuestions.set(paperId, questionIds);

      // 1. Create Attempt for Student 1 with Shuffle ON
      const startRes1 = await createOrRecoverExamAttempt(student1Id, paperId);
      expect(startRes1.success).toBe(true);
      const attempt1Id = startRes1.data!.attemptId;

      // 2. Fetch Exam State 1
      const state1 = await getExamState(student1Id, attempt1Id);
      expect(state1.success).toBe(true);
      const loadedQIds1 = state1.data!.questions.map((q) => q.id);
      expect(loadedQIds1).toHaveLength(5);
      expect(new Set(loadedQIds1)).toEqual(new Set(questionIds));

      // 3. Re-fetch Exam State 1 (simulating refresh/reload) -> order MUST remain identical
      const state1Refresh = await getExamState(student1Id, attempt1Id);
      const loadedQIds1Refresh = state1Refresh.data!.questions.map((q) => q.id);
      expect(loadedQIds1Refresh).toEqual(loadedQIds1);
    });
  });

  describe('4. Paper Builder & Question Management Simplification', () => {
    it('allows saving paper draft with 0 questions attached', async () => {
      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Empty Draft Test Paper',
        course: 'DCA Computer Science',
        durationMinutes: 45,
        requiredQuestionCount: 10,
        totalMarks: 10,
        markingMode: 'EQUAL_MARKS',
        showResultToStudent: false,
        shuffleQuestions: true,
        status: 'DRAFT',
        selectedQuestions: [],
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('DRAFT');
    });

    it('allows saving paper draft with fewer questions than required count', async () => {
      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Partial Questions Draft',
        course: 'DCA Computer Science',
        durationMinutes: 45,
        requiredQuestionCount: 10,
        totalMarks: 10,
        markingMode: 'EQUAL_MARKS',
        showResultToStudent: false,
        shuffleQuestions: true,
        status: 'DRAFT',
        selectedQuestions: [
          { questionId: 'q-step11-001', questionOrder: 1 },
          { questionId: 'q-step11-002', questionOrder: 2 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('DRAFT');
    });

    it('rejects publishing paper when selected questions count does not match required count', async () => {
      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Incomplete Published Test Paper',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 5,
        markingMode: 'EQUAL_MARKS',
        status: 'PUBLISHED',
        selectedQuestions: [
          { questionId: 'q-step11-001', questionOrder: 1 },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match required questions count');
    });

    it('deleting a paper does not delete questions from global questions bank', async () => {
      const initialQCount = mockExamStore.questions.size;
      expect(initialQCount).toBeGreaterThan(0);

      const paperId = '00000000-0000-0000-0000-000000000088';
      mockExamStore.papers.set(paperId, {
        id: paperId,
        title: 'Paper To Delete',
        status: 'DRAFT',
      });

      const delRes = await deletePaper(adminId, paperId);
      expect(delRes.success).toBe(true);

      // Global questions bank must remain intact
      expect(mockExamStore.questions.size).toBe(initialQCount);
    });
  });

  describe('5. UUID Validation & Source of Truth Suite', () => {
    it('validates UUID format correctly and rejects temporary paper- strings', () => {
      expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUuid('paper-1790142099520-wxwqn')).toBe(false);
      expect(isUuid('invalid-string')).toBe(false);
      expect(isUuid('')).toBe(false);
      expect(isUuid(undefined)).toBe(false);
    });

    it('creates a new paper draft with a real UUID when no paperId is provided', async () => {
      const result = await createOrUpdatePaperDraft(adminId, {
        title: 'Brand New Paper',
        course: 'DCA',
        durationMinutes: 60,
        requiredQuestionCount: 5,
        totalMarks: 5,
        status: 'DRAFT',
      });

      expect(result.success).toBe(true);
      expect(result.paperId).toBeDefined();
      expect(isUuid(result.paperId)).toBe(true);
      expect(result.paperId).not.toContain('paper-');
    });
  });
});
