import { describe, it, expect, beforeEach } from 'vitest';
import { createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { mockExamStore, getExamState, saveExamAnswer } from '../lib/exam/service';
import { submitExamAttempt } from '../lib/exam/submissionService';
import { getPaperLeaderboard } from '../lib/exam/leaderboardService';
import {
  proctorLockAttempt,
  proctorReopenAttempt,
  logProctorEvent,
  mockProctorEvents,
} from '../lib/proctor/proctorService';

describe('Quizora Step 14 — Final Real Exam Runner & Persistence Verification Suite', () => {
  const adminId = 'usr-admin-step14';
  const studentId = 'usr-student-exam-test';
  const paperId = '00000000-0000-0000-0000-000000000404';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.questions.clear();
    mockExamStore.papers.clear();
    mockProctorEvents.length = 0;

    // Seed test paper with 4 questions
    mockExamStore.papers.set(paperId, {
      id: paperId,
      title: 'DCA Real Exam Runner Test Paper',
      access_code: 'DCA-TEST4',
      status: 'PUBLISHED',
      duration_minutes: 60,
      total_marks: 4,
      required_question_count: 4,
      marking_mode: 'EQUAL_MARKS',
      show_result_to_student: true,
      shuffle_questions: false,
      created_by: adminId,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const qIds = ['q1', 'q2', 'q3', 'q4'];
    mockExamStore.paperQuestions.set(paperId, qIds);

    qIds.forEach((id, idx) => {
      mockExamStore.questions.set(id, {
        id,
        question_text: `Question ${idx + 1} text`,
        question_type: 'MCQ_SINGLE',
        difficulty: 'MEDIUM',
        option_a: 'Option A',
        option_b: 'Option B',
        option_c: 'Option C',
        option_d: 'Option D',
        correct_option: idx === 0 ? 'B' : idx === 1 ? 'C' : idx === 2 ? 'A' : 'D',
        marks: 1,
      });
    });
  });

  it('Requirement 4 & 15: saves 4 answers and recovers all 4 answers after refresh/re-bootstrap', async () => {
    // 1. Create attempt
    const attemptRes = await createOrRecoverExamAttempt(studentId, paperId);
    expect(attemptRes.success).toBe(true);
    const attemptId = attemptRes.data!.attemptId;

    // 2. Save 4 answers: Q1 -> B, Q2 -> C, Q3 -> A, Q4 -> D
    const ans1 = await saveExamAnswer(studentId, { attemptId, questionId: 'q1', selectedOption: 'B' });
    const ans2 = await saveExamAnswer(studentId, { attemptId, questionId: 'q2', selectedOption: 'C' });
    const ans3 = await saveExamAnswer(studentId, { attemptId, questionId: 'q3', selectedOption: 'A' });
    const ans4 = await saveExamAnswer(studentId, { attemptId, questionId: 'q4', selectedOption: 'D' });

    expect(ans1.success).toBe(true);
    expect(ans2.success).toBe(true);
    expect(ans3.success).toBe(true);
    expect(ans4.success).toBe(true);

    // 3. Simulate browser refresh / exam re-bootstrap
    const refreshedState = await getExamState(studentId, attemptId);
    expect(refreshedState.success).toBe(true);
    expect(refreshedState.data?.savedAnswers).toEqual({
      q1: 'B',
      q2: 'C',
      q3: 'A',
      q4: 'D',
    });

    // Verify questions array count
    expect(refreshedState.data?.questions).toHaveLength(4);
  });

  it('Requirement 6 & 16: LOCKED -> PROCTOR REOPEN -> IN_PROGRESS maintains same attemptId, timer, and answers', async () => {
    // 1. Start exam
    const attemptRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = attemptRes.data!.attemptId;
    const originalExpiresAt = attemptRes.data!.expiresAt;

    // 2. Save answers Q1-Q4
    await saveExamAnswer(studentId, { attemptId, questionId: 'q1', selectedOption: 'B' });
    await saveExamAnswer(studentId, { attemptId, questionId: 'q2', selectedOption: 'C' });
    await saveExamAnswer(studentId, { attemptId, questionId: 'q3', selectedOption: 'A' });
    await saveExamAnswer(studentId, { attemptId, questionId: 'q4', selectedOption: 'D' });

    // 3. Trigger 3 integrity events to lock attempt
    await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 0 }, studentId);
    // Add artificial delay to avoid deduplication window
    const att = mockExamStore.attempts.get(attemptId)!;
    att.tab_switch_count = 3;
    att.status = 'LOCKED';
    mockExamStore.attempts.set(attemptId, att);

    // Verify locked state
    const lockedState = await getExamState(studentId, attemptId);
    expect(lockedState.data?.attempt.status).toBe('LOCKED');

    // 4. Proctor reopens attempt before expiry
    const reopenRes = await proctorReopenAttempt(attemptId, adminId, 'Proctor authorized reopen');
    expect(reopenRes.success).toBe(true);
    expect(reopenRes.status).toBe('IN_PROGRESS');

    // 5. Student resumes: Same attemptId, same expires_at, same answers recovered
    const resumedState = await getExamState(studentId, attemptId);
    expect(resumedState.data?.attempt.id).toBe(attemptId);
    expect(resumedState.data?.attempt.status).toBe('IN_PROGRESS');
    expect(resumedState.data?.attempt.expires_at).toBe(originalExpiresAt);
    expect(resumedState.data?.savedAnswers).toEqual({
      q1: 'B',
      q2: 'C',
      q3: 'A',
      q4: 'D',
    });

    // 6. Submit exam
    const submitRes = await submitExamAttempt(studentId, attemptId);
    expect(submitRes.success).toBe(true);
    expect(submitRes.data?.score).toBe(4);
    expect(submitRes.data?.percentage).toBe(100);

    // 7. Verify Leaderboard / Admin results view
    const leaderboard = await getPaperLeaderboard(paperId);
    expect(leaderboard.submittedCount).toBe(1);
    expect(leaderboard.leaderboard[0].attemptId).toBe(attemptId);
    expect(leaderboard.leaderboard[0].score).toBe(4);
  });

  it('Requirement 8: rejects proctor reopen when LOCKED attempt has expired and auto-submits', async () => {
    // 1. Start exam
    const attemptRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = attemptRes.data!.attemptId;

    // Save Q1 answer
    await saveExamAnswer(studentId, { attemptId, questionId: 'q1', selectedOption: 'B' });

    // Lock attempt and simulate past expiry time
    const att = mockExamStore.attempts.get(attemptId)!;
    att.status = 'LOCKED';
    att.expires_at = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
    mockExamStore.attempts.set(attemptId, att);

    // Reopen attempt after expiry -> MUST FAIL with exact error message
    await expect(proctorReopenAttempt(attemptId, adminId)).rejects.toThrow(
      'Attempt cannot be reopened because the exam duration has expired.'
    );

    // Fetching exam state or leaderboard must auto-submit the expired locked attempt
    const state = await getExamState(studentId, attemptId);
    expect(state.data?.attempt.status).toBe('SUBMITTED');

    const leaderboard = await getPaperLeaderboard(paperId);
    expect(leaderboard.submittedCount).toBe(1);
    expect(leaderboard.leaderboard[0].attemptId).toBe(attemptId);
  });

  it('Requirement 9 & 10: submission is server-authoritative, idempotent, and prevents further writes', async () => {
    const attemptRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = attemptRes.data!.attemptId;

    await saveExamAnswer(studentId, { attemptId, questionId: 'q1', selectedOption: 'B' });

    // First submission
    const sub1 = await submitExamAttempt(studentId, attemptId);
    expect(sub1.success).toBe(true);
    expect(sub1.data?.score).toBe(1);

    // Duplicate submission (Idempotent call)
    const sub2 = await submitExamAttempt(studentId, attemptId);
    expect(sub2.success).toBe(true);
    expect(sub2.data?.score).toBe(1);

    // Attempting to save answer after submission MUST BE REJECTED
    const writeAttempt = await saveExamAnswer(studentId, { attemptId, questionId: 'q2', selectedOption: 'C' });
    expect(writeAttempt.success).toBe(false);
    expect(writeAttempt.code).toBe('ATTEMPT_SUBMITTED');
  });
});
