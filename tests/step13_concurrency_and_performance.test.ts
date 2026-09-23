import { describe, it, expect, beforeEach } from 'vitest';
import { createOrRecoverExamAttempt, validateAccessCodeServerSide } from '../lib/exam/attemptService';
import { createOrUpdatePaperDraft } from '../lib/exam/paperService';
import { publishPaperServerSide } from '../lib/exam/publishService';
import { mockExamStore, getExamState, saveExamAnswer, saveExamProgress } from '../lib/exam/service';
import { listStudentAttempts, getProctorAttemptDetails, proctorLockAttempt, proctorReopenAttempt } from '../lib/proctor/proctorService';
import { formatForDateTimeInput } from '../components/admin/PaperBuilderForm';

describe('Quizora Step 13 — Emergency Production Concurrency, Performance & Consistency Suite', () => {
  const adminId = 'usr-admin-step13';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.questions.clear();
    mockExamStore.papers.clear();
  });

  describe('1. Concurrency & Idempotency Tests (10 to 200 Parallel Requests)', () => {
    it('handles 10 parallel attempt creation requests for the SAME student without duplicates (Idempotency)', async () => {
      const paperId = '00000000-0000-0000-0000-000000000101';
      const studentId = 'usr-student-idem';

      mockExamStore.papers.set(paperId, {
        id: paperId,
        title: 'Concurrent Idempotency Exam',
        access_code: 'CONCUR-10',
        status: 'PUBLISHED',
        duration_minutes: 60,
        total_marks: 50,
        required_question_count: 1,
        marking_mode: 'EQUAL_MARKS',
        show_result_to_student: false,
        shuffle_questions: true,
        created_by: adminId,
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, ['q-c1']);

      // Fire 10 parallel attempt creation requests simultaneously
      const promises = Array.from({ length: 10 }, () =>
        createOrRecoverExamAttempt(studentId, paperId)
      );

      const results = await Promise.all(promises);

      // All 10 requests must succeed
      results.forEach((res) => {
        expect(res.success).toBe(true);
        expect(res.data?.attemptId).toBeDefined();
      });

      // Every single request must return the EXACT SAME attempt ID
      const firstAttemptId = results[0].data!.attemptId;
      results.forEach((res) => {
        expect(res.data?.attemptId).toBe(firstAttemptId);
      });

      // Total attempts in store for this paper/student MUST BE EXACTLY 1
      const storedAttempts = Array.from(mockExamStore.attempts.values()).filter(
        (a) => a.user_id === studentId && a.paper_id === paperId
      );
      expect(storedAttempts).toHaveLength(1);
    });

    it('handles 200 concurrent distinct student attempt creations within 30 seconds', async () => {
      const paperId = '00000000-0000-0000-0000-000000000200';

      mockExamStore.papers.set(paperId, {
        id: paperId,
        title: '200 Student Concurrent Exam',
        access_code: 'SCALE-200',
        status: 'PUBLISHED',
        duration_minutes: 60,
        total_marks: 50,
        required_question_count: 1,
        marking_mode: 'EQUAL_MARKS',
        show_result_to_student: false,
        shuffle_questions: true,
        created_by: adminId,
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, ['q-s200']);

      const startTime = Date.now();

      // Fire 200 concurrent student attempts
      const promises = Array.from({ length: 200 }, (_, i) =>
        createOrRecoverExamAttempt(`usr-student-scale-${i + 1}`, paperId)
      );

      const results = await Promise.all(promises);
      const durationMs = Date.now() - startTime;

      expect(results).toHaveLength(200);
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(200);

      // Verify 200 distinct attempt IDs created
      const attemptIds = new Set(results.map((r) => r.data!.attemptId));
      expect(attemptIds.size).toBe(200);

      // Ensure benchmark completes well within reasonable budget (< 5000ms for 200 in-memory creates)
      expect(durationMs).toBeLessThan(5000);
    });
  });

  describe('2. Single Source of Truth & Data Consistency Tests', () => {
    it('proves Student State === Proctor State across attempt creation, Q navigation, lockout, and reopen', async () => {
      const paperId = '00000000-0000-0000-0000-000000000300';
      const studentId = 'usr-student-sync';

      mockExamStore.papers.set(paperId, {
        id: paperId,
        title: 'Consistency Exam',
        access_code: 'SYNC-100',
        status: 'PUBLISHED',
        duration_minutes: 60,
        total_marks: 10,
        required_question_count: 2,
        marking_mode: 'EQUAL_MARKS',
        show_result_to_student: false,
        shuffle_questions: false,
        created_by: adminId,
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockExamStore.paperQuestions.set(paperId, ['q-sync-1', 'q-sync-2']);

      // 1. Student creates attempt A
      const startRes = await createOrRecoverExamAttempt(studentId, paperId);
      expect(startRes.success).toBe(true);
      const attemptId = startRes.data!.attemptId;

      // Proctor checks list
      const proctorList1 = await listStudentAttempts({ paperId });
      const proctorAttempt1 = proctorList1.find((a) => a.attemptId === attemptId);
      expect(proctorAttempt1).toBeDefined();
      expect(proctorAttempt1?.rawStatus).toBe('IN_PROGRESS');

      // 2. Student updates progress (moves Q0 -> Q1)
      await saveExamProgress(studentId, { attemptId, questionIndex: 1 });

      // Student state
      const studentState1 = await getExamState(studentId, attemptId);
      expect(studentState1.data?.lastQuestionIndex).toBe(1);

      // Proctor details view
      const proctorDetails1 = await getProctorAttemptDetails(attemptId);
      expect(proctorDetails1.attempt.lastQuestionIndex).toBe(1);
      expect(proctorDetails1.attempt.status).toBe('IN_PROGRESS');

      // 3. Proctor locks attempt
      await proctorLockAttempt(attemptId, adminId, 'Manual proctor lockout test');

      // Student state receives LOCKED
      const studentStateLocked = await getExamState(studentId, attemptId);
      expect(studentStateLocked.data?.attempt.status).toBe('LOCKED');

      // Proctor state reflects LOCKED
      const proctorDetailsLocked = await getProctorAttemptDetails(attemptId);
      expect(proctorDetailsLocked.attempt.status).toBe('LOCKED');

      // 4. Proctor reopens attempt
      await proctorReopenAttempt(attemptId, adminId, 'Manual proctor reopen test');

      // Student state receives IN_PROGRESS
      const studentStateReopened = await getExamState(studentId, attemptId);
      expect(studentStateReopened.data?.attempt.status).toBe('IN_PROGRESS');
      expect(studentStateReopened.data?.lastQuestionIndex).toBe(1);
    });
  });

  describe('3. Multi-Cycle Schedule & Access Code Invariance (10 Saves)', () => {
    it('preserves exact schedule timestamps and access code across 10 consecutive save draft / reload / publish cycles', async () => {
      const startLocal = '2026-09-23T12:30';
      const endLocal = '2026-09-28T02:00';
      const accessCode = 'STABLE-CODE-99';

      const initialStartIso = new Date(startLocal).toISOString();
      const initialEndIso = new Date(endLocal).toISOString();

      // Create initial paper draft
      const draftRes = await createOrUpdatePaperDraft(adminId, {
        title: 'Multi Cycle Stability Test Paper',
        course: 'DCA',
        durationMinutes: 60,
        requiredQuestionCount: 1,
        totalMarks: 5,
        accessCode,
        startAt: initialStartIso,
        endAt: initialEndIso,
        status: 'DRAFT',
      });
      expect(createResId(draftRes)).toBeDefined();
      const paperId = draftRes.paperId!;

      // Simulate 10 consecutive save/reload cycles
      for (let i = 1; i <= 10; i++) {
        const stored = mockExamStore.papers.get(paperId)!;

        // Verify stored ISO timestamps match initial exactly
        expect(stored.start_at).toBe(initialStartIso);
        expect(stored.end_at).toBe(initialEndIso);
        expect(stored.access_code).toBe(accessCode);

        // Format into local input values
        const formStart = formatForDateTimeInput(stored.start_at);
        const formEnd = formatForDateTimeInput(stored.end_at);

        expect(formStart).toBe(startLocal);
        expect(formEnd).toBe(endLocal);

        // Save metadata again using formatted values
        const saveLoopRes = await createOrUpdatePaperDraft(adminId, {
          id: paperId,
          title: `Paper Title Iteration ${i}`,
          course: 'DCA',
          durationMinutes: 60,
          requiredQuestionCount: 1,
          totalMarks: 5,
          accessCode: stored.access_code,
          startAt: new Date(formStart).toISOString(),
          endAt: new Date(formEnd).toISOString(),
          status: 'DRAFT',
        });
        expect(saveLoopRes.success).toBe(true);
      }

      // Final Publish
      mockExamStore.questions.set('q-loop-1', {
        id: 'q-loop-1',
        paper_id: paperId,
        question_text: 'Loop Q',
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
      mockExamStore.paperQuestions.set(paperId, ['q-loop-1']);

      const pubRes = await publishPaperServerSide(adminId, paperId);
      expect(pubRes.success).toBe(true);

      const finalPaper = mockExamStore.papers.get(paperId)!;
      expect(finalPaper.start_at).toBe(initialStartIso);
      expect(finalPaper.end_at).toBe(initialEndIso);
      expect(finalPaper.access_code).toBe(accessCode);
    });
  });
});

function createResId(res: any): string | undefined {
  return res.paperId;
}
