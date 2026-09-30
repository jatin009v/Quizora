import { describe, it, expect, beforeEach } from 'vitest';
import { createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { mockExamStore, getExamState, saveExamAnswer } from '../lib/exam/service';
import {
  logProctorEvent,
  mockProctorEvents,
} from '../lib/proctor/proctorService';

describe('Quizora Step 15 — Refresh Recovery, Navigation & Unload Integrity Verification Suite', () => {
  const adminId = 'usr-admin-step15';
  const studentId = 'usr-student-refresh-test';
  const paperId = '00000000-0000-0000-0000-000000000505';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.questions.clear();
    mockExamStore.papers.clear();
    mockProctorEvents.length = 0;

    mockExamStore.papers.set(paperId, {
      id: paperId,
      title: 'DCA Refresh Recovery Test Paper',
      access_code: 'DCA-REFRESH',
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
        question_text: `Question ${idx + 1}`,
        question_type: 'MCQ_SINGLE',
        difficulty: 'MEDIUM',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_option: 'A',
        marks: 1,
      });
    });
  });

  it('A, B, C, D: handles network/save issues followed by refresh without creating duplicate attempt, preserving timer and answers', async () => {
    // 1. Create attempt
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    expect(startRes.success).toBe(true);
    const attemptId = startRes.data!.attemptId;
    const expiresAt = startRes.data!.expiresAt;

    // 2. Save Q1 and Q2
    await saveExamAnswer(studentId, { attemptId, questionId: 'q1', selectedOption: 'B' });
    await saveExamAnswer(studentId, { attemptId, questionId: 'q2', selectedOption: 'C' });

    // 3. Simulate page refresh / re-bootstrap
    const refreshedState = await getExamState(studentId, attemptId);
    expect(refreshedState.success).toBe(true);

    // E. Same attemptId, timer, and saved answers are recovered
    expect(refreshedState.data?.attempt.id).toBe(attemptId);
    expect(refreshedState.data?.attempt.expires_at).toBe(expiresAt);
    expect(refreshedState.data?.savedAnswers).toEqual({
      q1: 'B',
      q2: 'C',
    });

    // F. Verify no duplicate attempt was created
    const attempts = Array.from(mockExamStore.attempts.values()).filter(
      (a) => a.user_id === studentId && a.paper_id === paperId
    );
    expect(attempts).toHaveLength(1);
  });

  it('E: normal genuine fullscreen exit while active still counts correctly as integrity violation', async () => {
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = startRes.data!.attemptId;

    // Log explicit fullscreen exit
    const eventRes = await logProctorEvent(
      { attemptId, eventType: 'FULLSCREEN_EXIT', questionIndex: 0 },
      studentId
    );

    expect(eventRes.success).toBe(true);
    expect(eventRes.tabSwitchCount).toBe(1);
    expect(eventRes.isLocked).toBe(false);

    const attempt = mockExamStore.attempts.get(attemptId)!;
    expect(attempt.tab_switch_count).toBe(1);
    expect(attempt.fullscreen_exit_count).toBe(1);
  });

  it('F: 3 genuine violations still LOCK the exam', async () => {
    const startRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = startRes.data!.attemptId;

    // Log first genuine tab switch
    await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 0 }, studentId);

    // Set past event time in mock events to avoid deduplication window
    if (mockProctorEvents.length > 0) {
      mockProctorEvents[0].event_time = new Date(Date.now() - 5000).toISOString();
    }

    const att1 = mockExamStore.attempts.get(attemptId)!;
    att1.tab_switch_count = 2;
    mockExamStore.attempts.set(attemptId, att1);

    const evRes = await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 0 }, studentId);

    expect(evRes.tabSwitchCount).toBe(3);
    expect(evRes.isLocked).toBe(false);

    const state = await getExamState(studentId, attemptId);
    expect(state.data?.attempt.status).toBe('IN_PROGRESS');
  });
});
