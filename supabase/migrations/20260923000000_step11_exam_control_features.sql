-- ============================================================================
-- Quizora Migration 20260923000000: Step 11 Exam Control Features
-- Adds show_result_to_student and shuffle_questions to papers table
-- Adds question_order to exam_attempts table
-- ============================================================================

ALTER TABLE public.papers 
ADD COLUMN IF NOT EXISTS show_result_to_student BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.exam_attempts 
ADD COLUMN IF NOT EXISTS question_order JSONB DEFAULT NULL;
