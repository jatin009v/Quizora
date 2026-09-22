import { describe, it, expect, beforeEach } from 'vitest';
import { logProctorEvent, getProctorDashboardSummary, listProctorStudentAttempts, getProctorAttemptDetails, proctorLockAttempt, proctorReopenAttempt, mockProctorEvents } from '@/lib/proctor/proctorService';
import { saveExamAnswer, mockExamStore } from '@/lib/exam/service';
import { ExamAttempt, Answer } from '@/types/database';

describe('Step 5 - Browser Integrity Monitoring, Server-Authoritative 3-Violation Engine & Proctor Workflow', () => {
  const studentProfileId = 'student-uuid-555';
  const proctorProfileId = 'proctor-uuid-999';
  const paperId = 'paper-uuid-step5';
  const attemptId = 'attempt-uuid-step5';

  beforeEach(() => {
    // Reset mock stores before each test
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();
    mockProctorEvents.length = 0;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

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
      last_question_index: 2,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    mockExamStore.attempts.set(attemptId, attempt);
    mockExamStore.paperQuestions.set(paperId, ['q1', 'q2', 'q3']);
  });

  // 1. Fullscreen state can be detected & 2. Fullscreen exit creates event
  it('1 & 2. Should log FULLSCREEN_EXIT event without locking on single exit', async () => {
    const result = await logProctorEvent(
      { attemptId, eventType: 'FULLSCREEN_EXIT', questionIndex: 2 },
      studentProfileId
    );

    expect(result.success).toBe(true);
    expect(result.eventType).toBe('FULLSCREEN_EXIT');
    expect(result.tabSwitchCount).toBe(1);
    expect(result.isLocked).toBe(false);
    expect(result.warningMessage).toContain('1 integrity event detected');
  });

  // 3. Visibility change creates event
  it('3. Should log TAB_SWITCH event on page visibility hidden', async () => {
    const result = await logProctorEvent(
      { attemptId, eventType: 'TAB_SWITCH', questionIndex: 1 },
      studentProfileId
    );

    expect(result.success).toBe(true);
    expect(result.eventType).toBe('TAB_SWITCH');
    expect(result.tabSwitchCount).toBe(1);
    expect(result.isLocked).toBe(false);
  });

  // 4. Blur and focus events are safely handled
  it('4. Should log WINDOW_BLUR and WINDOW_FOCUS events', async () => {
    const blurRes = await logProctorEvent(
      { attemptId, eventType: 'WINDOW_BLUR', questionIndex: 0 },
      studentProfileId
    );
    expect(blurRes.success).toBe(true);

    const focusRes = await logProctorEvent(
      { attemptId, eventType: 'WINDOW_FOCUS', questionIndex: 0 },
      studentProfileId
    );
    expect(focusRes.success).toBe(true);
    // WINDOW_FOCUS is non-qualifying, count should remain 1 from blur
    expect(focusRes.tabSwitchCount).toBe(1);
  });

  // 5. Rapid duplicate browser signals deduplication within 2-second cooldown window
  it('5. Should deduplicate rapid browser signals within 2-second window', async () => {
    const ev1 = await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 0 }, studentProfileId);
    expect(ev1.tabSwitchCount).toBe(1);

    // Immediate second event (within cooldown)
    const ev2 = await logProctorEvent({ attemptId, eventType: 'WINDOW_BLUR', questionIndex: 0 }, studentProfileId);
    expect(ev2.tabSwitchCount).toBe(1); // Deduplicated, count remains 1!
  });

  // 6 & 7. First and Second violations produce warnings
  it('6 & 7. Should produce warning messages for 1st and 2nd qualifying violations', async () => {
    const ev1 = await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 0 }, studentProfileId);
    expect(ev1.tabSwitchCount).toBe(1);
    expect(ev1.isLocked).toBe(false);
    expect(ev1.warningMessage).toContain('1 integrity event');

    // Simulate event after 2-second cooldown window
    if (mockProctorEvents.length > 0) {
      mockProctorEvents[0].event_time = new Date(Date.now() - 3000).toISOString();
    }

    const ev2 = await logProctorEvent({ attemptId, eventType: 'FULLSCREEN_EXIT', questionIndex: 0 }, studentProfileId);
    expect(ev2.tabSwitchCount).toBe(2);
    expect(ev2.isLocked).toBe(false);
    expect(ev2.warningMessage).toContain('2 events recorded');
  });

  // 8. Third qualifying violation locks attempt
  it('8. Should lock attempt on 3rd qualifying violation', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.tab_switch_count = 2;
    mockExamStore.attempts.set(attemptId, attempt);

    // Simulate previous events occurring > 2s ago
    mockProctorEvents.push({
      id: 'old-ev',
      attempt_id: attemptId,
      event_type: 'TAB_SWITCH',
      event_time: new Date(Date.now() - 5000).toISOString(),
    });

    const ev3 = await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 5 }, studentProfileId);
    expect(ev3.tabSwitchCount).toBe(3);
    expect(ev3.isLocked).toBe(true);
    expect(ev3.status).toBe('LOCKED');
    expect(ev3.warningMessage).toContain('temporarily locked');

    const updated = mockExamStore.attempts.get(attemptId);
    expect(updated?.status).toBe('LOCKED');
  });

  // 10. Locked attempt cannot save answers
  it('10. Should reject answer modification when attempt is LOCKED', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.status = 'LOCKED';
    mockExamStore.attempts.set(attemptId, attempt);

    const saveRes = await saveExamAnswer(studentProfileId, {
      attemptId,
      questionId: 'q1',
      selectedOption: 'A',
    });

    expect(saveRes.success).toBe(false);
    expect(saveRes.code).toBe('ATTEMPT_LOCKED');
  });

  // 11. Student cannot unlock themselves
  it('11. Should reject student authorization attempt to unlock or reopen', async () => {
    await expect(proctorReopenAttempt(attemptId, studentProfileId)).rejects.toThrow();
  });

  // 14. Proctor can view authorized attempt details
  it('14. Should allow Proctor to fetch detailed attempt info & timeline', async () => {
    const details = await getProctorAttemptDetails(attemptId);
    expect(details.attempt.id).toBe(attemptId);
    expect(details.student.name).toBeDefined();
    expect(details.paper.title).toBeDefined();
    expect(Array.isArray(details.events)).toBe(true);
  });

  // 15. Proctor can lock an attempt
  it('15. Should allow Proctor to manually lock an attempt', async () => {
    const lockRes = await proctorLockAttempt(attemptId, proctorProfileId, 'Manual test lock');
    expect(lockRes.success).toBe(true);
    expect(lockRes.status).toBe('LOCKED');

    const updated = mockExamStore.attempts.get(attemptId);
    expect(updated?.status).toBe('LOCKED');
  });

  // 16-20. Proctor can reopen a locked attempt and preserve attempt state & question index
  it('16-20. Should allow Proctor to reopen locked attempt while preserving attempt ID, answers, question index, and timer', async () => {
    // 1. Set up locked attempt with saved answers
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.status = 'LOCKED';
    attempt.last_question_index = 4;
    mockExamStore.attempts.set(attemptId, attempt);

    mockExamStore.answers.set(`${attemptId}:q1`, {
      id: 'ans-1',
      attempt_id: attemptId,
      question_id: 'q1',
      selected_option: 'B',
      is_correct: null,
      marks_awarded: null,
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Proctor reopens attempt
    const reopenRes = await proctorReopenAttempt(attemptId, proctorProfileId, 'Manual test reopen');
    expect(reopenRes.success).toBe(true);
    expect(reopenRes.status).toBe('IN_PROGRESS');
    expect(reopenRes.attemptId).toBe(attemptId); // Same attempt ID!
    expect(reopenRes.lastQuestionIndex).toBe(4); // Same question index!

    const reopenedAttempt = mockExamStore.attempts.get(attemptId);
    expect(reopenedAttempt?.status).toBe('IN_PROGRESS');
    expect(reopenedAttempt?.locked_at).toBeNull();

    // Verify saved answer remains intact
    const savedAns = mockExamStore.answers.get(`${attemptId}:q1`);
    expect(savedAns?.selected_option).toBe('B');
  });

  // 21. Expired attempt cannot be reopened as active
  it('21. Should reject reopening an attempt that has already expired', async () => {
    const attempt = mockExamStore.attempts.get(attemptId)!;
    attempt.status = 'LOCKED';
    attempt.expires_at = new Date(Date.now() - 10000).toISOString(); // Expired 10 seconds ago
    mockExamStore.attempts.set(attemptId, attempt);

    await expect(proctorReopenAttempt(attemptId, proctorProfileId)).rejects.toThrow('expired');
  });

  // 25. Correct answers are not exposed in proctor attempt details
  it('25. Should not expose sensitive correct_option in attempt details', async () => {
    const details = await getProctorAttemptDetails(attemptId);
    expect((details as any).correct_option).toBeUndefined();
  });
});
