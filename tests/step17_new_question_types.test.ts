import { describe, it, expect, beforeEach } from 'vitest';
import { isAnswerCorrect, submitExamAttempt } from '@/lib/exam/submissionService';
import { mockExamStore } from '@/lib/exam/service';

describe('Quizora Step 17 — Next-Generation Question Types & Multi-Type Grading Suite', () => {
  beforeEach(() => {
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.questions.clear();
    mockExamStore.paperQuestions.clear();
    mockExamStore.papers.clear();
  });

  describe('1. isAnswerCorrect Unit Tests', () => {
    it('correctly grades SINGLE_CHOICE / MCQ_SINGLE questions', () => {
      expect(isAnswerCorrect('SINGLE_CHOICE', 'A', 'A')).toBe(true);
      expect(isAnswerCorrect('SINGLE_CHOICE', 'a', 'A')).toBe(true);
      expect(isAnswerCorrect('MCQ_SINGLE', 'B', 'A')).toBe(false);
      expect(isAnswerCorrect('SINGLE_CHOICE', 'C', 'C')).toBe(true);
    });

    it('correctly grades TRUE_FALSE questions', () => {
      expect(isAnswerCorrect('TRUE_FALSE', 'A', 'A')).toBe(true);
      expect(isAnswerCorrect('TRUE_FALSE', 'True', 'A')).toBe(true);
      expect(isAnswerCorrect('TRUE_FALSE', 'B', 'B')).toBe(true);
      expect(isAnswerCorrect('TRUE_FALSE', 'False', 'B')).toBe(true);
      expect(isAnswerCorrect('TRUE_FALSE', 'A', 'B')).toBe(false);
    });

    it('enforces EXACT_MATCH rule for MULTIPLE_CHOICE questions', () => {
      // Full correct match
      expect(isAnswerCorrect('MULTIPLE_CHOICE', 'A,C,D', 'A,C,D')).toBe(true);
      expect(isAnswerCorrect('MULTIPLE_CHOICE', 'D,A,C', 'A,C,D')).toBe(true);
      expect(isAnswerCorrect('MULTIPLE_CHOICE', '["A","C","D"]', 'A,C,D')).toBe(true);

      // Partial match is marked INCORRECT under EXACT_MATCH
      expect(isAnswerCorrect('MULTIPLE_CHOICE', 'A,C', 'A,C,D')).toBe(false);

      // Extra option selected is marked INCORRECT
      expect(isAnswerCorrect('MULTIPLE_CHOICE', 'A,B,C,D', 'A,C,D')).toBe(false);

      // Wrong option selected is marked INCORRECT
      expect(isAnswerCorrect('MULTIPLE_CHOICE', 'B', 'A,C,D')).toBe(false);
    });
  });

  describe('2. Full Server-Side Grading with Mixed Question Types', () => {
    it('correctly grades an exam attempt with SINGLE_CHOICE, MULTIPLE_CHOICE, and TRUE_FALSE questions', async () => {
      const paperId = 'paper-nextgen-001';
      const studentId = 'usr-student-nextgen';
      const attemptId = 'attempt-nextgen-001';

      // 1. Setup paper with 3 questions (10 marks each)
      mockExamStore.papers.set(paperId, {
        id: paperId,
        title: 'Computer Science Next-Gen Test',
        description: 'Multi-type exam',
        course: 'MCA',
        duration_minutes: 60,
        total_marks: 30,
        required_question_count: 3,
        marking_mode: 'EQUAL_MARKS',
        status: 'PUBLISHED',
        access_code: 'CS-NEXTGEN',
        start_at: new Date(Date.now() - 3600000).toISOString(),
        end_at: new Date(Date.now() + 86400000).toISOString(),
        show_result_to_student: true,
        shuffle_questions: false,
        created_by: 'admin-001',
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Question 1: SINGLE_CHOICE
      const q1 = {
        id: 'q1-sc',
        question_text: 'What is the output of printf("%d", 10 + 20);?',
        question_type: 'SINGLE_CHOICE' as const,
        difficulty: 'EASY' as const,
        option_a: '10',
        option_b: '30',
        option_c: '20',
        option_d: '300',
        correct_option: 'B',
        marks: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Question 2: MULTIPLE_CHOICE
      const q2 = {
        id: 'q2-mc',
        question_text: 'Select all compiled programming languages:',
        question_type: 'MULTIPLE_CHOICE' as const,
        difficulty: 'MEDIUM' as const,
        option_a: 'C',
        option_b: 'C++',
        option_c: 'Java',
        option_d: 'HTML',
        correct_option: 'A,B,C',
        code_snippet: 'int main() { return 0; }',
        marks: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Question 3: TRUE_FALSE
      const q3 = {
        id: 'q3-tf',
        question_text: 'JavaScript is a statically typed programming language.',
        question_type: 'TRUE_FALSE' as const,
        difficulty: 'EASY' as const,
        option_a: 'True',
        option_b: 'False',
        option_c: '-',
        option_d: '-',
        correct_option: 'B',
        marks: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockExamStore.questions.set(q1.id, q1 as any);
      mockExamStore.questions.set(q2.id, q2 as any);
      mockExamStore.questions.set(q3.id, q3 as any);

      mockExamStore.paperQuestions.set(paperId, [q1.id, q2.id, q3.id]);

      // 2. Setup active attempt
      mockExamStore.attempts.set(attemptId, {
        id: attemptId,
        user_id: studentId,
        paper_id: paperId,
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        submitted_at: null,
        locked_at: null,
        score: null,
        total_marks: 30,
        tab_switch_count: 0,
        fullscreen_exit_count: 0,
        last_question_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 3. Submit attempt with unconfirmed client answers:
      // Q1: 'B' (Correct -> 10 marks)
      // Q2: 'A,B,C' (Correct -> 10 marks)
      // Q3: 'B' (Correct -> 10 marks)
      const res = await submitExamAttempt(studentId, attemptId, {
        [q1.id]: 'B',
        [q2.id]: 'A,B,C',
        [q3.id]: 'B',
      });

      expect(res.success).toBe(true);
      expect(res.data?.score).toBe(30);
      expect(res.data?.percentage).toBe(100);

      // Verify attempt state updated to SUBMITTED
      const finalAtt = mockExamStore.attempts.get(attemptId);
      expect(finalAtt?.status).toBe('SUBMITTED');
      expect(finalAtt?.score).toBe(30);
    });
  });
});
