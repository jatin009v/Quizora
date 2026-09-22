import { describe, it, expect, beforeEach } from 'vitest';
import { createOrRecoverExamAttempt } from '@/lib/exam/attemptService';
import { saveExamAnswer, mockExamStore } from '@/lib/exam/service';
import { submitExamAttempt } from '@/lib/exam/submissionService';
import { proctorLockAttempt, proctorReopenAttempt, logProctorEvent, mockProctorEvents } from '@/lib/proctor/proctorService';
import { requireProctor, requireAdmin } from '@/lib/auth/session';
import { ExamAttempt, Question, Profile } from '@/types/database';
import { mockUserProfiles } from '@/lib/auth/userService';

describe('Step 6 - Production Hardening, State Machine Security & Timer Audit Suite', () => {
  const studentProfileId = 'student-step6-001';
  const proctorProfileId = 'proctor-step6-999';
  const paperId = 'paper-step6-100';
  const attemptId = 'attempt-step6-500';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();
    mockUserProfiles.clear();
    mockProctorEvents.length = 0;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    mockUserProfiles.set(studentProfileId, {
      id: studentProfileId,
      auth_user_id: `auth-${studentProfileId}`,
      name: 'Student Step6',
      course: 'DCA',
      roll_number: '2026-DCA-999',
      username: 'student6',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const attempt: ExamAttempt = {
      id: attemptId,
      user_id: studentProfileId,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: now.toISOString(),
      expires_at: expiresAt,
      submitted_at: null,
      locked_at: null,
      score: null,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    mockExamStore.attempts.set(attemptId, attempt);
    mockExamStore.paperQuestions.set(paperId, ['q1', 'q2']);

    const question1: Question = {
      id: 'q1',
      question_text: 'What is 2+2?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      option_a: '3',
      option_b: '4',
      option_c: '5',
      option_d: '6',
      correct_option: 'B',
      explanation: '2+2=4',
      marks: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    mockExamStore.questions.set('q1', question1);
  });

  // 1. State Machine: Reject SUBMITTED -> IN_PROGRESS transition
  it('1. Should reject modifying answers or reopening a SUBMITTED attempt', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.status = 'SUBMITTED';
    attempt.submitted_at = new Date().toISOString();
    mockExamStore.attempts.set(attemptId, attempt);

    // Answer modification check
    const saveRes = await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'A',
    });
    expect(saveRes.success).toBe(false);
    expect(saveRes.code).toBe('ATTEMPT_SUBMITTED');

    // Proctor lock check on submitted attempt
    await expect(proctorLockAttempt(attemptId, proctorProfileId)).rejects.toThrow('submitted');
  });

  // 2. State Machine: Reject EXPIRED -> IN_PROGRESS reopening
  it('2. Should reject reopening an attempt whose server expires_at timer has passed', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.status = 'LOCKED';
    attempt.expires_at = new Date(Date.now() - 5000).toISOString(); // Expired 5 seconds ago
    mockExamStore.attempts.set(attemptId, attempt);

    await expect(proctorReopenAttempt(attemptId, proctorProfileId)).rejects.toThrow('expired');
  });

  // 3. Timer Hardening: Submitting answers after server expiry returns EXAM_EXPIRED
  it('3. Should return EXAM_EXPIRED when saving answer after expires_at', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.expires_at = new Date(Date.now() - 1000).toISOString(); // Expired
    mockExamStore.attempts.set(attemptId, attempt);

    const saveRes = await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'B',
    });

    expect(saveRes.success).toBe(false);
    expect(saveRes.code).toBe('EXAM_EXPIRED');
  });

  // 4. Role Security: Reopening attempt throws error for non-proctor callers
  it('4. Should reject reopen operations for unauthorized student callers', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.status = 'LOCKED';
    mockExamStore.attempts.set(attemptId, attempt);

    // Passing studentProfileId instead of proctorProfileId fails authorization check
    await expect(proctorReopenAttempt(attemptId, studentProfileId)).rejects.toThrow();
  });

  // 5. Answer Idempotency: Multiple answer saves for same question update single record cleanly
  it('5. Should handle idempotent answer updates without row duplication', async () => {
    // 1st Save
    const res1 = await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'A',
      clientTimestamp: Date.now(),
    });
    expect(res1.success).toBe(true);

    // 2nd Save (Option change A -> B)
    const res2 = await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'B',
      clientTimestamp: Date.now() + 10,
    });
    expect(res2.success).toBe(true);

    // Verify mock store contains exactly 1 answer row for (attemptId, q1)
    const ansKey = `${attemptId}:q1`;
    const ans = mockExamStore.answers.get(ansKey);
    expect(ans?.selected_option).toBe('B');
  });

  // 6. Out-of-Order Network Request Protection: Stale client timestamp is dropped
  it('6. Should discard out-of-order stale answer request with older timestamp', async () => {
    const nowMs = Date.now();

    // 1. Save newer answer timestamp
    await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'C',
      clientTimestamp: nowMs + 500,
    });

    // 2. Receive delayed stale answer request timestamped in the past
    await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'A',
      clientTimestamp: nowMs - 500,
    });

    // Verify stored answer remains 'C' (latest timestamp preserved)
    const ansKey = `${attemptId}:q1`;
    const ans = mockExamStore.answers.get(ansKey);
    expect(ans?.selected_option).toBe('C');
  });

  // 7. Atomic Submission: Grading calculates score server-side and sets status to SUBMITTED
  it('7. Should calculate score server-side and lock attempt as SUBMITTED', async () => {
    // Save correct answer 'B'
    await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'B',
    });

    const subRes = await submitExamAttempt(studentProfileId, attemptId);
    expect(subRes.success).toBe(true);
    expect(subRes.data?.score).toBeGreaterThan(0);

    const updated = mockExamStore.attempts.get(attemptId);
    expect(updated?.status).toBe('SUBMITTED');
  });
});
