-- Quizora Migration 20260923000003: Database Uniqueness Index for Exam Attempts
-- Prevents duplicate exam attempts for the same student + paper under high concurrency.

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_paper_attempt 
ON public.exam_attempts (user_id, paper_id);
