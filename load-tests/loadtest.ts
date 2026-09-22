import { mockExamStore, saveExamAnswer } from '../lib/exam/service';
import { validateAccessCodeServerSide, createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { submitExamAttempt } from '../lib/exam/submissionService';
import { logProctorEvent } from '../lib/proctor/proctorService';
import { mockUserProfiles } from '../lib/auth/userService';
import { ExamAttempt, Question } from '../types/database';

// Force isolated test execution environment
(process.env as any).NODE_ENV = 'test';

const CONCURRENT_STUDENTS = 200;
const QUESTIONS_PER_PAPER = 50;

async function runLoadTest() {
  console.log('================================================================================');
  console.log(`🚀 QUIZORA DCA PLATFORM — HIGH-CONCURRENCY LOAD TEST BENCHMARK`);
  console.log(`Target Scenario: ${CONCURRENT_STUDENTS} Concurrent Students | ${QUESTIONS_PER_PAPER} Questions Per Exam`);
  console.log('================================================================================\n');

  const startTime = Date.now();
  const latencies: number[] = [];
  let totalRequests = 0;
  let failedRequests = 0;
  let failedAnswerSaves = 0;
  let failedSubmissions = 0;

  // 1. Setup & Seed Data
  const paperId = 'paper-loadtest-500';
  const accessCode = 'DCA-7K4P9X';
  const nowIso = new Date().toISOString();

  mockExamStore.attempts.clear();
  mockExamStore.answers.clear();
  mockExamStore.questions.clear();
  mockExamStore.paperQuestions.clear();
  mockUserProfiles.clear();

  // Create 50 Questions
  const qIds: string[] = [];
  for (let q = 1; q <= QUESTIONS_PER_PAPER; q++) {
    const qId = `q-loadtest-${q}`;
    qIds.push(qId);

    const question: Question = {
      id: qId,
      question_text: `Load Test Question ${q}: What is the primary complexity of binary search?`,
      question_type: 'MCQ_SINGLE',
      difficulty: q % 3 === 0 ? 'HARD' : q % 2 === 0 ? 'MEDIUM' : 'EASY',
      option_a: 'O(1)',
      option_b: 'O(log N)',
      option_c: 'O(N)',
      option_d: 'O(N^2)',
      correct_option: q % 2 === 0 ? 'B' : 'A',
      explanation: 'Binary search divides search space in half at each step.',
      marks: 1,
      created_at: nowIso,
      updated_at: nowIso,
    };
    mockExamStore.questions.set(qId, question);
  }
  mockExamStore.paperQuestions.set(paperId, qIds);

  console.log(`[SEED] Created ${QUESTIONS_PER_PAPER} MCQ Questions for Paper ID: ${paperId}`);
  console.log(`[SEED] Generating ${CONCURRENT_STUDENTS} Mock Student Identities...\n`);

  // Create 200 Mock Students
  const studentIds: string[] = [];
  for (let s = 1; s <= CONCURRENT_STUDENTS; s++) {
    const sId = `student-user-${s.toString().padStart(3, '0')}`;
    studentIds.push(sId);

    mockUserProfiles.set(sId, {
      id: sId,
      auth_user_id: `auth-${sId}`,
      name: `Load Student ${s}`,
      course: 'DCA Computer Science',
      roll_number: `2026-DCA-${s.toString().padStart(3, '0')}`,
      username: `student${s}`,
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  console.log(`⚡ Launching ${CONCURRENT_STUDENTS} Concurrent Student Pipelines...`);

  // Helper to measure latency per operation
  const measureOp = async <T>(fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    totalRequests++;
    try {
      const result = await fn();
      const end = performance.now();
      latencies.push(end - start);
      return result;
    } catch (err) {
      failedRequests++;
      const end = performance.now();
      latencies.push(end - start);
      throw err;
    }
  };

  // 2. Execute 200 Concurrent Student Pipelines
  const studentTasks = studentIds.map(async (studentId, studentIdx) => {
    // A. Validate Access Code
    const valRes = await measureOp(() => validateAccessCodeServerSide(studentId, accessCode));
    if (!valRes.success) throw new Error(`Access code validation failed for ${studentId}`);

    // B. Start / Recover Attempt
    const startRes = await measureOp(() => createOrRecoverExamAttempt(studentId, paperId));
    if (!startRes.success || !startRes.data?.attemptId) {
      throw new Error(`Attempt creation failed for ${studentId}`);
    }
    const attemptId = startRes.data.attemptId;

    // C. Progressively Answer 50 Questions
    const options: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    for (let qIdx = 0; qIdx < qIds.length; qIdx++) {
      const qId = qIds[qIdx];
      // Distribute selections across A, B, C, D
      const selected = options[(studentIdx + qIdx) % 4];

      const ansRes = await measureOp(() =>
        saveExamAnswer(studentId, {
          attemptId,
          questionId: qId,
          selectedOption: selected,
          clientTimestamp: Date.now(),
        })
      );

      if (!ansRes.success) {
        failedAnswerSaves++;
      }
    }

    // D. Simulate integrity events for 10% of students
    if (studentIdx % 10 === 0) {
      await measureOp(() =>
        logProctorEvent(
          { attemptId, eventType: 'TAB_SWITCH', questionIndex: 12 },
          studentId
        )
      );
    }

    // E. Submit Exam
    const subRes = await measureOp(() => submitExamAttempt(studentId, attemptId));
    if (!subRes.success) {
      failedSubmissions++;
    }
  });

  // Await completion of all 200 student pipelines
  await Promise.all(studentTasks);

  const endTime = Date.now();
  const totalDurationSec = (endTime - startTime) / 1000;

  // Calculate Metrics
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const throughput = totalRequests / totalDurationSec;
  const successRate = (((totalRequests - failedRequests) / totalRequests) * 100).toFixed(2);

  console.log('\n================================================================================');
  console.log(`📊 LOAD TEST BENCHMARK RESULTS SUMMARY`);
  console.log('================================================================================');
  console.table({
    'Concurrent Students': CONCURRENT_STUDENTS,
    'Questions Per Exam': QUESTIONS_PER_PAPER,
    'Total API Operations': totalRequests,
    'Benchmark Duration (sec)': totalDurationSec.toFixed(2),
    'Throughput (ops/sec)': throughput.toFixed(2),
    'Average Latency (ms)': avgLatency.toFixed(2),
    'P95 Latency (ms)': p95Latency.toFixed(2),
    'Failed Answer Saves': failedAnswerSaves,
    'Failed Submissions': failedSubmissions,
    'Total Request Errors': failedRequests,
    'Success Rate': `${successRate}%`,
  });

  if (failedRequests === 0 && failedAnswerSaves === 0 && failedSubmissions === 0) {
    console.log('✅ HIGH-CONCURRENCY LOAD TEST PASSED: 100% SUCCESS RATE ACROSS 200 STUDENTS!\n');
  } else {
    console.error('❌ LOAD TEST FAILED WITH ERRORS!');
    process.exit(1);
  }
}

runLoadTest().catch((err) => {
  console.error('Load test runner crashed:', err);
  process.exit(1);
});
