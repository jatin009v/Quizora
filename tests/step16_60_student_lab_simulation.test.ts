import { describe, it, expect, beforeEach } from 'vitest';
import { mockExamStore, saveExamAnswer, getExamState } from '../lib/exam/service';
import { createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { submitExamAttempt } from '../lib/exam/submissionService';
import { logProctorEvent, listStudentAttempts, getProctorDashboardSummary, mockProctorEvents } from '../lib/proctor/proctorService';
import { normalizeAccessCode } from '../lib/exam/accessCode';
import { mockUserProfiles } from '../lib/auth/userService';

describe('QUIZORA — Real 60-Student Concurrency & Server-Authoritative Grading Suite', () => {
  const paperId = 'paper-lab60-2026';
  const accessCode = 'LAB60-TEST';
  const studentCount = 60;
  const questionCount = 5;
  const totalPaperMarks = 50;
  const perQuestionMark = 10;

  beforeEach(() => {
    // Reset stores
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.papers.clear();
    mockUserProfiles.clear();
    mockProctorEvents.length = 0;

    // 1. Seed 5 test questions with known correct options
    const questionIds: string[] = [];
    const correctOptions = ['A', 'B', 'C', 'D', 'A'];

    for (let i = 0; i < questionCount; i++) {
      const qId = `q-lab60-${i + 1}`;
      questionIds.push(qId);
      mockExamStore.questions.set(qId, {
        id: qId,
        question_text: `Lab Test Question #${i + 1}?`,
        question_type: 'MCQ_SINGLE',
        option_a: `Option A for Q${i + 1}`,
        option_b: `Option B for Q${i + 1}`,
        option_c: `Option C for Q${i + 1}`,
        option_d: `Option D for Q${i + 1}`,
        correct_option: correctOptions[i],
        marks: perQuestionMark,
      });
    }

    // 2. Seed published paper
    mockExamStore.papers.set(paperId, {
      id: paperId,
      title: '60-Student Production Lab Exam',
      access_code: accessCode,
      status: 'PUBLISHED',
      duration_minutes: 60,
      total_marks: totalPaperMarks,
      required_question_count: questionCount,
    });
    mockExamStore.paperQuestions.set(paperId, questionIds);

    // 3. Seed 60 student profiles
    for (let s = 1; s <= studentCount; s++) {
      const studentId = `user-student-${s}`;
      const username = `bca2026_${s.toString().padStart(2, '0')}`;
      mockUserProfiles.set(studentId, {
        id: studentId,
        auth_user_id: studentId,
        username,
        name: `Student #${s}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        course: 'BCA',
        year: '2nd Year',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  it('proves 60 concurrent student workflow with 100% correct grading and 60/60 proctor visibility', async () => {
    const startTime = Date.now();

    let successCount = 0;
    let failureCount = 0;
    let accessCodeFailures = 0;
    let answerSaveFailures = 0;
    let submitFailures = 0;
    let correctResultCount = 0;

    const latencies: number[] = [];

    // Run 60 students concurrently
    const studentPromises = Array.from({ length: studentCount }, async (_, index) => {
      const sNum = index + 1;
      const studentId = `user-student-${sNum}`;
      const studentStart = Date.now();

      try {
        // Step 1: Access code validation
        const normalized = normalizeAccessCode(accessCode);
        const paper = Array.from(mockExamStore.papers.values()).find(
          (p) => normalizeAccessCode(p.access_code) === normalized && p.status === 'PUBLISHED'
        );

        if (!paper) {
          accessCodeFailures++;
          failureCount++;
          return;
        }

        // Step 2: Attempt creation / recovery
        const attRes = await createOrRecoverExamAttempt(studentId, paperId);
        if (!attRes.success || !attRes.data) {
          failureCount++;
          return;
        }
        const attemptId = attRes.data.attemptId;

        // Step 3: Exam state bootstrap
        const state = await getExamState(studentId, attemptId);
        if (!state.success || !state.data) {
          failureCount++;
          return;
        }

        // Step 4: Record integrity events (Simulate tab switches & window blur)
        // Verify 3+ events do NOT cause automatic lockout!
        if (sNum % 3 === 0) {
          await logProctorEvent({ attemptId, eventType: 'TAB_SWITCH', questionIndex: 0 }, studentId);
          await logProctorEvent({ attemptId, eventType: 'FULLSCREEN_EXIT', questionIndex: 1 }, studentId);
          await logProctorEvent({ attemptId, eventType: 'WINDOW_BLUR', questionIndex: 2 }, studentId);
        }

        // Step 5: Answer saves
        // First 40 students answer ALL 5 questions correctly (Expected score: 50 / 50, 100%)
        // Students 41-60 answer 3 questions correctly and 2 wrong (Expected score: 30 / 50, 60%)
        const correctOptions = ['A', 'B', 'C', 'D', 'A'];
        const targetAnswers: Record<string, string> = {};

        for (let qIdx = 0; qIdx < questionCount; qIdx++) {
          const qId = `q-lab60-${qIdx + 1}`;
          let chosenOpt = correctOptions[qIdx];
          if (sNum > 40 && qIdx >= 3) {
            // Give wrong option for Q4 and Q5
            chosenOpt = chosenOpt === 'A' ? 'B' : 'A';
          }
          targetAnswers[qId] = chosenOpt;

          const saveRes = await saveExamAnswer(studentId, {
            attemptId,
            questionId: qId,
            selectedOption: chosenOpt as 'A' | 'B' | 'C' | 'D',
          });

          if (!saveRes.success) {
            answerSaveFailures++;
          }
        }

        // Step 6: Submission with server-side reconciliation payload
        const subRes = await submitExamAttempt(studentId, attemptId, targetAnswers);
        if (!subRes.success || !subRes.data) {
          submitFailures++;
          failureCount++;
          return;
        }

        // Step 7: Verify result correctness
        const expectedScore = sNum <= 40 ? 50 : 30;
        const expectedPct = sNum <= 40 ? 100 : 60;

        if (subRes.data.score === expectedScore && subRes.data.percentage === expectedPct) {
          correctResultCount++;
        }

        successCount++;
        latencies.push(Date.now() - studentStart);
      } catch (err) {
        failureCount++;
      }
    });

    await Promise.all(studentPromises);

    // Sort latencies for percentile calculations
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

    // Step 8: Proctor Dashboard Visibility Check
    const proctorAttempts = await listStudentAttempts();
    const proctorSummary = await getProctorDashboardSummary(paperId);

    console.log('--- REAL 60-STUDENT CONCURRENCY SIMULATION METRICS ---');
    console.log(`Total Concurrent Students: ${studentCount}`);
    console.log(`Success Count: ${successCount} / 60`);
    console.log(`Failure Count: ${failureCount}`);
    console.log(`Access Code Failures: ${accessCodeFailures}`);
    console.log(`Answer Save Failures: ${answerSaveFailures}`);
    console.log(`Submit Failures: ${submitFailures}`);
    console.log(`Correctly Graded Results: ${correctResultCount} / 60`);
    console.log(`Proctor Visible Attempts: ${proctorAttempts.length} / 60`);
    console.log(`Latency p50: ${p50}ms | p95: ${p95}ms`);

    // Strict Assertions
    expect(successCount).toBe(60);
    expect(failureCount).toBe(0);
    expect(accessCodeFailures).toBe(0);
    expect(answerSaveFailures).toBe(0);
    expect(submitFailures).toBe(0);
    expect(correctResultCount).toBe(60);
    expect(proctorAttempts.length).toBe(60);
    expect(proctorSummary.summary.submittedCount).toBe(60);
    expect(proctorSummary.summary.lockedCount).toBe(0); // Lockout is monitoring-only!
  });

  it('proves submit request idempotency and safe double-submit prevention', async () => {
    const studentId = 'user-student-1';
    const attRes = await createOrRecoverExamAttempt(studentId, paperId);
    const attemptId = attRes.data!.attemptId;

    await saveExamAnswer(studentId, { attemptId, questionId: 'q-lab60-1', selectedOption: 'A' });

    // First submit
    const sub1 = await submitExamAttempt(studentId, attemptId);
    expect(sub1.success).toBe(true);
    expect(sub1.data?.score).toBe(10);

    // Immediate second submit (duplicate request under network retry)
    const sub2 = await submitExamAttempt(studentId, attemptId);
    expect(sub2.success).toBe(true);
    expect(sub2.data?.score).toBe(10); // Idempotent: score unchanged!
  });
});
