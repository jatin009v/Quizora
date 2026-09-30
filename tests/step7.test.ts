import { describe, it, expect, beforeEach } from 'vitest';
import { createOrRecoverExamAttempt, validateAccessCodeServerSide } from '@/lib/exam/attemptService';
import { saveExamAnswer, mockExamStore } from '@/lib/exam/service';
import { submitExamAttempt } from '@/lib/exam/submissionService';
import { logProctorEvent, getProctorAttemptDetails, proctorLockAttempt, proctorReopenAttempt, mockProctorEvents } from '@/lib/proctor/proctorService';
import { getPaperLeaderboard } from '@/lib/exam/leaderboardService';
import { ExamAttempt, Question, Answer } from '@/types/database';
import { mockUserProfiles } from '@/lib/auth/userService';

describe('Step 7 — Production Release Candidate & Critical Reopen Verification Suite', () => {
  const studentId = 'student-rc-001';
  const proctorId = 'proctor-rc-999';
  const paperId = 'paper-rc-777';
  const accessCode = 'DCA-7K4P9X';
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();
    mockUserProfiles.clear();
    mockProctorEvents.length = 0;

    // Seed mock student & proctor profiles
    mockUserProfiles.set(studentId, {
      id: studentId,
      auth_user_id: `auth-${studentId}`,
      name: 'Release Candidate Student',
      course: 'DCA Computer Science',
      year: '1st Year',
      username: 'rc_student',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    mockUserProfiles.set(proctorId, {
      id: proctorId,
      auth_user_id: `auth-${proctorId}`,
      name: 'Proctor Officer',
      course: 'DCA',
      year: '1st Year',
      username: 'rc_proctor',
      role: 'PROCTOR',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // Seed 3 questions for paper
    const q1: Question = {
      id: 'q-rc-1',
      question_text: 'What is the default port for HTTP?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      option_a: '21',
      option_b: '80',
      option_c: '443',
      option_d: '8080',
      correct_option: 'B',
      marks: 1,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const q2: Question = {
      id: 'q-rc-2',
      question_text: 'Which SQL command is used to fetch data?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      option_a: 'SELECT',
      option_b: 'UPDATE',
      option_c: 'DELETE',
      option_d: 'INSERT',
      correct_option: 'A',
      marks: 1,
      created_at: nowIso,
      updated_at: nowIso,
    };

    mockExamStore.questions.set('q-rc-1', q1);
    mockExamStore.questions.set('q-rc-2', q2);
    mockExamStore.paperQuestions.set(paperId, ['q-rc-1', 'q-rc-2']);
  });

  // 1. Critical Reopen End-to-End Lifecycle Test
  it('1. CRITICAL REOPEN TEST: Complete lifecycle preserve ID, answers, question index, and server timer on proctor reopen', async () => {
    // A. Validate Access Code
    const valRes = await validateAccessCodeServerSide(studentId, accessCode);
    expect(valRes.success).toBe(true);

    // B. Start Exam Attempt
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    expect(startRes.success).toBe(true);
    const originalAttemptId = startRes.data!.attemptId;
    const originalExpiresAt = startRes.data!.expiresAt;
    const originalStartedAt = startRes.data!.startedAt;

    // C. Save Answer for Q1
    const ans1Res = await saveExamAnswer(studentId, {
      attemptId: originalAttemptId,
      questionId: 'q-rc-1',
      selectedOption: 'B',
    });
    expect(ans1Res.success).toBe(true);

    // D. Move to Question 2 (index 1)
    const attemptBeforeLock = mockExamStore.attempts.get(originalAttemptId)!;
    attemptBeforeLock.last_question_index = 1;

    // E. Trigger 3 Qualifying Integrity Violations (Lockout)
    const ev1 = await logProctorEvent({ attemptId: originalAttemptId, eventType: 'TAB_SWITCH', questionIndex: 1 }, studentId);
    expect(ev1.tabSwitchCount).toBe(1);

    // Fast-forward cooldown in mock store for 2nd violation
    mockProctorEvents[0].event_time = new Date(Date.now() - 3000).toISOString();
    const ev2 = await logProctorEvent({ attemptId: originalAttemptId, eventType: 'FULLSCREEN_EXIT', questionIndex: 1 }, studentId);
    expect(ev2.tabSwitchCount).toBe(2);

    // Fast-forward cooldown in mock store for 3rd violation
    mockProctorEvents[1].event_time = new Date(Date.now() - 3000).toISOString();
    const ev3 = await logProctorEvent({ attemptId: originalAttemptId, eventType: 'TAB_SWITCH', questionIndex: 1 }, studentId);
    expect(ev3.tabSwitchCount).toBe(3);

    // Proctor manually locks attempt
    const lockRes = await proctorLockAttempt(originalAttemptId, proctorId, 'Proctor manual lock');
    expect(lockRes.status).toBe('LOCKED');

    const blockedAnsRes = await saveExamAnswer(studentId, {
      attemptId: originalAttemptId,
      questionId: 'q-rc-2',
      selectedOption: 'A',
    });
    expect(blockedAnsRes.success).toBe(false);
    expect(blockedAnsRes.code).toBe('ATTEMPT_LOCKED');

    // G. Proctor Inspects Timeline
    const detailsBeforeReopen = await getProctorAttemptDetails(originalAttemptId);
    expect(detailsBeforeReopen.attempt.status).toBe('LOCKED');
    expect(detailsBeforeReopen.events.some((e: any) => e.eventType === 'EXAM_LOCKED')).toBe(true);

    // H. Proctor Reopens Exam Attempt
    const reopenRes = await proctorReopenAttempt(originalAttemptId, proctorId, 'Proctor approved candidate return');
    expect(reopenRes.success).toBe(true);
    expect(reopenRes.status).toBe('IN_PROGRESS');

    // I. VERIFY ALL 6 CRITICAL PRESERVATION GUARANTEES
    const reopenedAttempt = mockExamStore.attempts.get(originalAttemptId)!;
    expect(reopenedAttempt.id).toBe(originalAttemptId); // 1. SAME Attempt ID!
    expect(reopenedAttempt.paper_id).toBe(paperId); // 2. SAME Paper ID!
    expect(reopenedAttempt.status).toBe('IN_PROGRESS'); // 3. Status IN_PROGRESS!
    expect(reopenedAttempt.started_at).toBe(originalStartedAt); // 4. SAME Started At!
    expect(reopenedAttempt.expires_at).toBe(originalExpiresAt); // 5. SAME Expires At (Timer NOT extended)!
    expect(reopenedAttempt.last_question_index).toBe(1); // 6. SAME Question Index!

    // Verify Q1 saved answer remains intact
    const ans1Preserved = mockExamStore.answers.get(`${originalAttemptId}:q-rc-1`);
    expect(ans1Preserved?.selected_option).toBe('B');

    // J. Resume Exam: Student answers Q2 and submits
    const ans2Res = await saveExamAnswer(studentId, {
      attemptId: originalAttemptId,
      questionId: 'q-rc-2',
      selectedOption: 'A',
    });
    expect(ans2Res.success).toBe(true);

    const submitRes = await submitExamAttempt(studentId, originalAttemptId);
    expect(submitRes.success).toBe(true);
    expect(submitRes.data?.score).toBe(50); // 2/2 correct (100% of 50 total paper marks)
    expect(submitRes.data?.percentage).toBe(100);

    const finalAttempt = mockExamStore.attempts.get(originalAttemptId)!;
    expect(finalAttempt.status).toBe('SUBMITTED');
  });

  // 2. Answer Tampering Protection
  it('2. Should ignore or reject client payload tampering with score, marks_awarded, or correct_option', async () => {
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = startRes.data!.attemptId;

    // Client passes extra fields attempting to manipulate grading
    const maliciousPayload = {
      attemptId,
      questionId: 'q-rc-1',
      selectedOption: 'A', // Incorrect option (correct is B)
      score: 100, // Malicious override
      is_correct: true, // Malicious override
      marks_awarded: 50, // Malicious override
    };

    const ansRes = await saveExamAnswer(studentId, maliciousPayload as any);
    expect(ansRes.success).toBe(true);

    // Submit attempt and verify server overrides malicious fields
    const subRes = await submitExamAttempt(studentId, attemptId);
    expect(subRes.success).toBe(true);
    // Score must be calculated strictly server-side based on actual question.correct_option!
    expect(subRes.data?.score).toBe(0); // Q1 selected A (incorrect) -> 0 marks!
  });

  // 3. Student Proctor Endpoint Authorization Protection
  it('3. Should reject student role execution of proctor lock or reopen actions', async () => {
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = startRes.data!.attemptId;

    // Student attempting to call proctor lock
    await expect(proctorLockAttempt(attemptId, studentId)).rejects.toThrow('Unauthorized');

    // Student attempting to call proctor reopen
    await expect(proctorReopenAttempt(attemptId, studentId)).rejects.toThrow('Unauthorized');
  });

  // 4. Timer Extension Tampering Protection
  it('4. Should reject timer extension when system clock or client parameters are altered', async () => {
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = startRes.data!.attemptId;

    const attempt = mockExamStore.attempts.get(attemptId)!;
    const originalExpiresAt = attempt.expires_at;

    // Client attempts to pass a fake extended expires_at or clientTimestamp in the future
    await saveExamAnswer(studentId, {
      attemptId,
      questionId: 'q-rc-1',
      selectedOption: 'B',
      clientTimestamp: Date.now() + 100000000, // Client clock 1000 hours in future
    });

    const refreshedAttempt = mockExamStore.attempts.get(attemptId)!;
    // Authoritative expires_at MUST remain unchanged!
    expect(refreshedAttempt.expires_at).toBe(originalExpiresAt);
  });
});
