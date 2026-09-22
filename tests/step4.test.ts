import { describe, it, expect, beforeEach } from 'vitest';
import { publishPaperServerSide } from '../lib/exam/publishService';
import { validateAccessCodeServerSide, createOrRecoverExamAttempt } from '../lib/exam/attemptService';
import { generateSecureAccessCode, normalizeAccessCode } from '../lib/exam/accessCode';
import { accessCodeRateLimiter } from '../lib/exam/rateLimiter';
import { saveExamAnswer, getExamState, mockExamStore } from '../lib/exam/service';

describe('Quizora DCA Quiz Platform — Step 4 Publishing & Exam Execution Suite', () => {
  const adminId = 'usr-admin-001';
  const student1Id = 'usr-student-001';
  const student2Id = 'usr-student-002';
  const paperId = 'paper-step4-001';
  const q1Id = 'q-step4-101';
  const q2Id = 'q-step4-102';
  const attempt1Id = 'att-step4-001';

  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();
    accessCodeRateLimiter.reset(student1Id);

    // Populate question catalog
    mockExamStore.questions.set(q1Id, {
      id: q1Id,
      question_text: 'What is the default port for HTTP?',
      option_a: '80',
      option_b: '443',
      option_c: '8080',
      option_d: '21',
      correct_option: 'A',
      marks: 1,
    });

    mockExamStore.questions.set(q2Id, {
      id: q2Id,
      question_text: 'What is the default port for HTTPS?',
      option_a: '80',
      option_b: '443',
      option_c: '8080',
      option_d: '22',
      correct_option: 'B',
      marks: 1,
    });

    mockExamStore.paperQuestions.set(paperId, [q1Id, q2Id]);
  });

  it('1. Cryptographic access code is unpredictable and uppercase', () => {
    const code1 = generateSecureAccessCode('DCA');
    const code2 = generateSecureAccessCode('DCA');

    expect(code1).toMatch(/^DCA-[2-9A-Z]{6}$/);
    expect(code1).not.toBe(code2);
  });

  it('2. Access code normalization handles lowercase and spaces', () => {
    expect(normalizeAccessCode('  dca-7k4p9x  ')).toBe('DCA-7K4P9X');
  });

  it('3. Admin can publish paper and generate access code', async () => {
    const pub = await publishPaperServerSide(adminId, paperId);
    expect(pub.success).toBe(true);
    expect(pub.data?.accessCode).toMatch(/^DCA-[2-9A-Z]{6}$/);
  });

  it('4. Student can validate published access code', async () => {
    const res = await validateAccessCodeServerSide(student1Id, 'DCA-7K4P9X');
    expect(res.success).toBe(true);
    expect(res.data?.paperId).toBe(paperId);
  });

  it('5. Invalid access code returns generic error', async () => {
    const res = await validateAccessCodeServerSide(student1Id, 'INVALID-CODE-999');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid or unavailable exam code.');
  });

  it('6. Rate limiter throttles excessive invalid access code attempts', () => {
    const rateKey = 'test-student-rate-key';
    accessCodeRateLimiter.reset(rateKey);

    for (let i = 0; i < 5; i++) {
      accessCodeRateLimiter.recordAttempt(rateKey);
    }

    const check = accessCodeRateLimiter.isRateLimited(rateKey, 5, 60000);
    expect(check.limited).toBe(true);
    expect(check.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('7. Server creates exam attempt with server-authoritative started_at and expires_at', async () => {
    const startRes = await createOrRecoverExamAttempt(student1Id, paperId);
    expect(startRes.success).toBe(true);
    expect(startRes.data?.status).toBe('IN_PROGRESS');

    const startedTime = new Date(startRes.data!.startedAt).getTime();
    const expiresTime = new Date(startRes.data!.expiresAt).getTime();
    expect(expiresTime - startedTime).toBe(60 * 60 * 1000); // Exactly 60 minutes!
  });

  it('8. Existing IN_PROGRESS attempt is recovered on reload', async () => {
    const firstStart = await createOrRecoverExamAttempt(student1Id, paperId);
    const firstAttemptId = firstStart.data!.attemptId;

    const secondStart = await createOrRecoverExamAttempt(student1Id, paperId);
    expect(secondStart.success).toBe(true);
    expect(secondStart.data!.attemptId).toBe(firstAttemptId); // Recovered identical attempt!
  });

  it('9. Student ownership check blocks unauthorized student from viewing another attempt', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      submitted_at: null,
      locked_at: null,
      score: null,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await getExamState(student2Id, attempt1Id);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized attempt access');
  });

  it('10. Zero exposure of correct_option in student state payload', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      submitted_at: null,
      locked_at: null,
      score: null,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await getExamState(student1Id, attempt1Id);
    expect(res.success).toBe(true);
    const questions = res.data!.questions;

    questions.forEach((q: any) => {
      expect(q.correct_option).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    });
  });

  it('11. Expired attempt rejects answer modifications (EXAM_EXPIRED)', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'IN_PROGRESS',
      started_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago!
      submitted_at: null,
      locked_at: null,
      score: null,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await saveExamAnswer(student1Id, {
      attemptId: attempt1Id,
      questionId: q1Id,
      selectedOption: 'A',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('EXAM_EXPIRED');
  });

  it('12. SUBMITTED attempt prevents starting a duplicate attempt', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      started_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      locked_at: null,
      score: 50,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await createOrRecoverExamAttempt(student1Id, paperId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('ATTEMPT_SUBMITTED');
  });

  it('13. LOCKED attempt prevents starting a duplicate attempt', async () => {
    mockExamStore.attempts.set(attempt1Id, {
      id: attempt1Id,
      user_id: student1Id,
      paper_id: paperId,
      status: 'LOCKED',
      started_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      submitted_at: null,
      locked_at: new Date().toISOString(),
      score: null,
      total_marks: 50,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await createOrRecoverExamAttempt(student1Id, paperId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('ATTEMPT_LOCKED');
  });
});
