import { describe, it, expect, beforeEach } from 'vitest';
import { generateSecureAccessCode, normalizeAccessCode } from '../lib/exam/accessCode';
import { createOrUpdatePaperDraft, isUuid } from '../lib/exam/paperService';
import { publishPaperServerSide } from '../lib/exam/publishService';
import { validateAccessCodeServerSide, createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { getExamState, mockExamStore } from '../lib/exam/service';

describe('Quizora Step 12 — Paper-Centric Architecture & Access Code Control Suite', () => {
  const adminId = 'usr-admin-step12';
  const studentId = 'usr-student-step12';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.questions.clear();
    mockExamStore.papers.clear();
  });

  describe('1. Access Code Generation & Formatting', () => {
    it('generates a secure 10-character uppercase access code with prefix', () => {
      const code = generateSecureAccessCode('DCA');
      expect(code).toHaveLength(10);
      expect(code.startsWith('DCA-')).toBe(true);
      expect(code).toBe(code.toUpperCase());
      expect(code).not.toContain('DCA2026');
      expect(code).not.toContain('123456');
    });

    it('normalizes access codes to uppercase and trims whitespace', () => {
      expect(normalizeAccessCode('  dca-7x9p2x  ')).toBe('DCA-7X9P2X');
      expect(normalizeAccessCode('dca-test')).toBe('DCA-TEST');
    });
  });

  describe('2. Paper Publish Rules & Access Code Validation', () => {
    it('rejects publishing a paper without an access code', async () => {
      const now = new Date();
      const startAt = new Date(now.getTime() - 600000).toISOString();
      const endAt = new Date(now.getTime() + 3600000).toISOString();

      // 1. Create draft paper without access code
      const draftRes = await createOrUpdatePaperDraft(adminId, {
        title: 'No Access Code Paper',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode: '',
        startAt,
        endAt,
        selectedQuestions: [{ questionId: 'q-1', questionOrder: 1 }],
      });
      expect(draftRes.success).toBe(true);
      const paperId = draftRes.paperId!;

      // Populate mock question
      mockExamStore.questions.set('q-1', {
        id: 'q-1',
        paper_id: paperId,
        question_text: 'What is 2+2?',
        question_type: 'MCQ_SINGLE',
        difficulty: 'EASY',
        option_a: '4',
        option_b: '3',
        option_c: '2',
        option_d: '1',
        correct_option: 'A',
        marks: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, ['q-1']);

      // 2. Attempt publish
      const pubRes = await publishPaperServerSide(adminId, paperId);
      expect(pubRes.success).toBe(false);
      expect(pubRes.error).toContain('access code');
    });

    it('stores normalized access code and publishes successfully when required questions match', async () => {
      const now = new Date();
      const startAt = new Date(now.getTime() - 600000).toISOString();
      const endAt = new Date(now.getTime() + 3600000).toISOString();
      const accessCode = generateSecureAccessCode('DCA');

      const draftRes = await createOrUpdatePaperDraft(adminId, {
        title: 'Valid Access Code Paper',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode: accessCode,
        startAt,
        endAt,
        selectedQuestions: [{ questionId: 'q-2', questionOrder: 1 }],
      });
      expect(draftRes.success).toBe(true);
      const paperId = draftRes.paperId!;

      mockExamStore.questions.set('q-2', {
        id: 'q-2',
        paper_id: paperId,
        question_text: 'What is HTML?',
        question_type: 'MCQ_SINGLE',
        difficulty: 'EASY',
        option_a: 'HyperText Markup Language',
        option_b: 'High Tech ML',
        option_c: 'Hard Text Logic',
        option_d: 'None',
        correct_option: 'A',
        marks: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, ['q-2']);

      const pubRes = await publishPaperServerSide(adminId, paperId);
      expect(pubRes.success).toBe(true);
      expect(pubRes.accessCode).toBe(normalizeAccessCode(accessCode));
    });

    it('rejects duplicate access code for another active/published paper', async () => {
      const now = new Date();
      const startAt = new Date(now.getTime() - 600000).toISOString();
      const endAt = new Date(now.getTime() + 3600000).toISOString();
      const duplicateCode = 'DCA-7X9P2X';

      // First paper published with DCA-7X9P2X
      const paper1Res = await createOrUpdatePaperDraft(adminId, {
        title: 'Paper 1',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode: duplicateCode,
        startAt,
        endAt,
        status: 'PUBLISHED',
        selectedQuestions: [{ questionId: 'q-p1', questionOrder: 1 }],
      });

      // Second paper draft attempting to use same code
      const paper2Res = await createOrUpdatePaperDraft(adminId, {
        title: 'Paper 2',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode: duplicateCode,
        startAt,
        endAt,
        status: 'DRAFT',
        selectedQuestions: [{ questionId: 'q-p2', questionOrder: 1 }],
      });

      expect(paper2Res.success).toBe(false);
      expect(paper2Res.error).toContain('already in use');
    });

    it('saves draft with 0, partial, or all questions without clearing paper_questions', async () => {
      // 1. Save draft with 0 questions & incomplete metadata
      const draft0 = await createOrUpdatePaperDraft(adminId, {
        title: 'Draft 0 Questions',
        course: '',
        durationMinutes: 0,
        requiredQuestionCount: 5,
        totalMarks: 0,
        status: 'DRAFT',
      });
      expect(draft0.success).toBe(true);
      const paperId = draft0.paperId!;

      // 2. Attach 5 questions to paperQuestions store
      const qIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
      mockExamStore.paperQuestions.set(paperId, qIds);
      qIds.forEach((id) => {
        mockExamStore.questions.set(id, {
          id,
          paper_id: paperId,
          question_text: `Question ${id}`,
          question_type: 'MCQ_SINGLE',
          difficulty: 'MEDIUM',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          correct_option: 'A',
          marks: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // 3. Save draft metadata again (without selectedQuestions payload)
      const draftUpdate = await createOrUpdatePaperDraft(adminId, {
        id: paperId,
        title: 'Updated Draft Title',
        course: 'DCA',
        durationMinutes: 60,
        requiredQuestionCount: 5,
        totalMarks: 5,
        status: 'DRAFT',
      });
      expect(draftUpdate.success).toBe(true);

      // Verify paperQuestions were NOT cleared
      expect(mockExamStore.paperQuestions.get(paperId)).toHaveLength(5);
    });

    it('publishes paper based on authoritative paper_questions count in DB/Store, ignoring client selectedQuestions', async () => {
      const now = new Date();
      const startAt = new Date(now.getTime() - 600000).toISOString();
      const endAt = new Date(now.getTime() + 3600000).toISOString();
      const accessCode = 'AUTH-CODE55';

      // Create draft paper requiring 5 questions
      const draftRes = await createOrUpdatePaperDraft(adminId, {
        title: 'Authoritative Publish Test',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 25,
        accessCode,
        startAt,
        endAt,
        status: 'DRAFT',
      });
      const paperId = draftRes.paperId!;

      // Case A: 0 questions attached -> Reject publish
      const pub0 = await publishPaperServerSide(adminId, paperId);
      expect(pub0.success).toBe(false);
      expect(pub0.error).toBeDefined();

      // Case B: 4 questions attached (4 / 5) -> Reject publish
      const qIds4 = ['q-a1', 'q-a2', 'q-a3', 'q-a4'];
      mockExamStore.paperQuestions.set(paperId, qIds4);
      qIds4.forEach((id) => {
        mockExamStore.questions.set(id, {
          id,
          paper_id: paperId,
          question_text: `Q ${id}`,
          question_type: 'MCQ_SINGLE',
          difficulty: 'EASY',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          correct_option: 'A',
          marks: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      const pub4 = await publishPaperServerSide(adminId, paperId);
      expect(pub4.success).toBe(false);
      expect(pub4.error).toContain('4');

      // Case C: Add 5th question (5 / 5) -> Publish succeeds!
      const qIds5 = [...qIds4, 'q-a5'];
      mockExamStore.paperQuestions.set(paperId, qIds5);
      mockExamStore.questions.set('q-a5', {
        id: 'q-a5',
        paper_id: paperId,
        question_text: 'Q q-a5',
        question_type: 'MCQ_SINGLE',
        difficulty: 'EASY',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_option: 'A',
        marks: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const pub5 = await publishPaperServerSide(adminId, paperId);
      expect(pub5.success).toBe(true);
      expect(pub5.data?.paperId).toBe(paperId);
    });

    it('guarantees SAVE PAPER METADATA != MODIFY PAPER QUESTIONS across multiple field updates and legacy payloads', async () => {
      // 1. Create paper with 5 questions
      const createRes = await createOrUpdatePaperDraft(adminId, {
        title: 'Initial Title',
        course: 'DCA',
        durationMinutes: 30,
        requiredQuestionCount: 5,
        totalMarks: 25,
        status: 'DRAFT',
      });
      const paperId = createRes.paperId!;
      const qIds = ['q-m1', 'q-m2', 'q-m3', 'q-m4', 'q-m5'];
      mockExamStore.paperQuestions.set(paperId, qIds);

      // 2. Change title -> Save -> Verify questions unchanged
      await createOrUpdatePaperDraft(adminId, { id: paperId, title: 'Changed Title', status: 'DRAFT' });
      expect(mockExamStore.paperQuestions.get(paperId)).toEqual(qIds);

      // 3. Change duration -> Save -> Verify questions unchanged
      await createOrUpdatePaperDraft(adminId, { id: paperId, title: 'Changed Title', durationMinutes: 90, status: 'DRAFT' });
      expect(mockExamStore.paperQuestions.get(paperId)).toEqual(qIds);

      // 4. Change result visibility -> Save -> Verify questions unchanged
      await createOrUpdatePaperDraft(adminId, { id: paperId, title: 'Changed Title', showResultToStudent: true, status: 'DRAFT' });
      expect(mockExamStore.paperQuestions.get(paperId)).toEqual(qIds);

      // 5. Change shuffle setting -> Save -> Verify questions unchanged
      await createOrUpdatePaperDraft(adminId, { id: paperId, title: 'Changed Title', shuffleQuestions: false, status: 'DRAFT' });
      expect(mockExamStore.paperQuestions.get(paperId)).toEqual(qIds);

      // 6. Send legacy selectedQuestions: [] -> Verify questions are NOT deleted
      await createOrUpdatePaperDraft(adminId, { id: paperId, title: 'With Empty Selected Qs', selectedQuestions: [], status: 'DRAFT' });
      expect(mockExamStore.paperQuestions.get(paperId)).toHaveLength(5);
    });

    it('maintains strict question isolation between Paper A and Paper B during repeated metadata saves', async () => {
      // Paper A (5 questions)
      const resA = await createOrUpdatePaperDraft(adminId, { title: 'Paper A', course: 'DCA', requiredQuestionCount: 5, status: 'DRAFT' });
      const paperAId = resA.paperId!;
      const qA = ['qa1', 'qa2', 'qa3', 'qa4', 'qa5'];
      mockExamStore.paperQuestions.set(paperAId, [...qA]);

      // Paper B (5 questions)
      const resB = await createOrUpdatePaperDraft(adminId, { title: 'Paper B', course: 'DCA', requiredQuestionCount: 5, status: 'DRAFT' });
      const paperBId = resB.paperId!;
      const qB = ['qb1', 'qb2', 'qb3', 'qb4', 'qb5'];
      mockExamStore.paperQuestions.set(paperBId, [...qB]);

      // Save Paper A metadata repeatedly
      await createOrUpdatePaperDraft(adminId, { id: paperAId, title: 'Paper A Updated 1', status: 'DRAFT' });
      await createOrUpdatePaperDraft(adminId, { id: paperAId, title: 'Paper A Updated 2', durationMinutes: 45, status: 'DRAFT' });
      await createOrUpdatePaperDraft(adminId, { id: paperAId, title: 'Paper A Updated 3', shuffleQuestions: false, status: 'DRAFT' });

      // Verify Paper A = 5 questions, Paper B = 5 questions
      expect(mockExamStore.paperQuestions.get(paperAId)).toHaveLength(5);
      expect(mockExamStore.paperQuestions.get(paperBId)).toHaveLength(5);

      // Delete one question from Paper A
      mockExamStore.paperQuestions.set(paperAId, ['qa1', 'qa2', 'qa3', 'qa4']);

      // Verify Paper A = 4 questions, Paper B = 5 questions
      expect(mockExamStore.paperQuestions.get(paperAId)).toHaveLength(4);
      expect(mockExamStore.paperQuestions.get(paperBId)).toHaveLength(5);
    });
  });

  describe('3. Student Access Code & Access Schedule Window Validation', () => {
    let paperId: string;
    const correctCode = 'MCA-PASS1X';

    beforeEach(async () => {
      const now = new Date();
      const startAt = new Date(now.getTime() - 600000).toISOString(); // 10 mins ago
      const endAt = new Date(now.getTime() + 3600000).toISOString(); // 1 hour later

      const draftRes = await createOrUpdatePaperDraft(adminId, {
        title: 'Active Schedule MCA Paper',
        course: 'MCA',
        durationMinutes: 60,
        requiredQuestionCount: 1,
        totalMarks: 10,
        accessCode: correctCode,
        startAt,
        endAt,
        status: 'PUBLISHED',
        selectedQuestions: [{ questionId: 'q-mca-1', questionOrder: 1 }],
      });

      paperId = draftRes.paperId!;
      mockExamStore.questions.set('q-mca-1', {
        id: 'q-mca-1',
        paper_id: paperId,
        question_text: 'MCA Core Question',
        question_type: 'MCQ_SINGLE',
        difficulty: 'MEDIUM',
        option_a: 'Opt A',
        option_b: 'Opt B',
        option_c: 'Opt C',
        option_d: 'Opt D',
        correct_option: 'A',
        marks: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, ['q-mca-1']);
    });

    it('allows access when access code is correct and schedule is active', async () => {
      const valRes = await validateAccessCodeServerSide(studentId, correctCode);
      expect(valRes.success).toBe(true);
      expect(valRes.data?.paperId).toBe(paperId);
    });

    it('rejects invalid or wrong access code', async () => {
      const valRes = await validateAccessCodeServerSide(studentId, 'WRONGCODE');
      expect(valRes.success).toBe(false);
      expect(valRes.error).toContain('Invalid or unavailable exam code.');
    });

    it('rejects access code before schedule start_at', async () => {
      const now = new Date();
      const futureStart = new Date(now.getTime() + 3600000).toISOString(); // 1 hour in future
      const futureEnd = new Date(now.getTime() + 7200000).toISOString();

      mockExamStore.papers.set(paperId, {
        ...mockExamStore.papers.get(paperId)!,
        start_at: futureStart,
        end_at: futureEnd,
      });

      const valRes = await validateAccessCodeServerSide(studentId, correctCode);
      expect(valRes.success).toBe(false);
      expect(valRes.error).toContain('has not started yet');
    });

    it('rejects access code after schedule end_at for new exam entry', async () => {
      const now = new Date();
      const pastStart = new Date(now.getTime() - 7200000).toISOString(); // 2 hours ago
      const pastEnd = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago

      mockExamStore.papers.set(paperId, {
        ...mockExamStore.papers.get(paperId)!,
        start_at: pastStart,
        end_at: pastEnd,
      });

      const valRes = await validateAccessCodeServerSide(studentId, correctCode);
      expect(valRes.success).toBe(false);
      expect(valRes.error).toContain('has closed');
    });
  });

  describe('4. Question Isolation & Paper-Centric Architecture', () => {
    it('ensures questions belong directly to a paper and deleting MCA question does not affect BCA paper', async () => {
      // 1. Create MCA Paper (Paper A)
      const mcaRes = await createOrUpdatePaperDraft(adminId, {
        title: 'MCA Paper',
        course: 'MCA',
        durationMinutes: 30,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode: 'MCATEST1',
        selectedQuestions: [],
      });
      const mcaPaperId = mcaRes.paperId!;

      // 2. Create BCA Paper (Paper B)
      const bcaRes = await createOrUpdatePaperDraft(adminId, {
        title: 'BCA Paper',
        course: 'BCA',
        durationMinutes: 30,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode: 'BCATEST1',
        selectedQuestions: [],
      });
      const bcaPaperId = bcaRes.paperId!;

      // 3. Add question A1 to Paper A
      const qMcaId = 'q-mca-iso-1';
      const questionA1 = {
        id: qMcaId,
        paper_id: mcaPaperId,
        question_text: 'What is Computer Science?',
        question_type: 'MCQ_SINGLE',
        difficulty: 'MEDIUM',
        option_a: 'Tree',
        option_b: 'Graph',
        option_c: 'Array',
        option_d: 'All',
        correct_option: 'D',
        marks: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockExamStore.questions.set(qMcaId, questionA1);
      mockExamStore.paperQuestions.set(mcaPaperId, [qMcaId]);

      // 4. Add question B1 with IDENTICAL TEXT to Paper B
      const qBcaId = 'q-bca-iso-1';
      const questionB1 = {
        id: qBcaId,
        paper_id: bcaPaperId,
        question_text: 'What is Computer Science?',
        question_type: 'MCQ_SINGLE',
        difficulty: 'EASY',
        option_a: 'HTML',
        option_b: 'CSS',
        option_c: 'JS',
        option_d: 'All',
        correct_option: 'D',
        marks: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockExamStore.questions.set(qBcaId, questionB1);
      mockExamStore.paperQuestions.set(bcaPaperId, [qBcaId]);

      // Verify both questions exist
      expect(mockExamStore.questions.has(qMcaId)).toBe(true);
      expect(mockExamStore.questions.has(qBcaId)).toBe(true);

      // 5. Edit Question A1 in Paper A
      mockExamStore.questions.get(qMcaId)!.question_text = 'EDITED MCA DATA STRUCTURES';

      // Expect Paper B's question text to remain 100% UNCHANGED
      expect(mockExamStore.questions.get(qBcaId)?.question_text).toBe('What is Computer Science?');

      // 6. Delete Question A1 from Paper A
      mockExamStore.questions.delete(qMcaId);
      mockExamStore.paperQuestions.set(mcaPaperId, []);

      // Expect Paper A's question deleted, Paper B's question remains intact
      expect(mockExamStore.questions.has(qMcaId)).toBe(false);
      expect(mockExamStore.questions.has(qBcaId)).toBe(true);
      expect(mockExamStore.questions.get(qBcaId)?.question_text).toBe('What is Computer Science?');
    });

    it('does not expose access_code or correct_option in getExamState responses to student', async () => {
      const paperId = '00000000-0000-0000-0000-000000000077';
      const qId = 'q-sec-77';

      mockExamStore.papers.set(paperId, {
        id: paperId,
        title: 'Secret Code Exam',
        access_code: 'SUPERSECRET99',
        status: 'PUBLISHED',
      });

      mockExamStore.questions.set(qId, {
        id: qId,
        paper_id: paperId,
        question_text: 'Security Question',
        question_type: 'MCQ_SINGLE',
        difficulty: 'EASY',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_option: 'A',
        marks: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, [qId]);

      const attemptRes = await createOrRecoverExamAttempt(studentId, paperId);
      expect(attemptRes.success).toBe(true);
      const attemptId = attemptRes.data!.attemptId;

      const state = await getExamState(studentId, attemptId);
      expect(state.success).toBe(true);

      // Access code and correct_option MUST NOT be leaked to student
      expect((state.data as any).access_code).toBeUndefined();
      expect((state.data?.questions[0] as any).correct_option).toBeUndefined();
    });
  });
});
