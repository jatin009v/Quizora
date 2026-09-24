-- Quizora Migration 20260923000003: Partial Database Uniqueness Index for Active Exam Attempts
-- Prevents duplicate ACTIVE exam attempts (NOT_STARTED, IN_PROGRESS, LOCKED) for the same student + paper under high concurrency.
-- Allows historical SUBMITTED attempts to remain intact.

DROP INDEX IF EXISTS public.idx_unique_user_paper_attempt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_user_paper_attempt 
ON public.exam_attempts (user_id, paper_id) 
WHERE status IN ('NOT_STARTED', 'IN_PROGRESS', 'LOCKED');
