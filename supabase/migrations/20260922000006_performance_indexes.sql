-- Quizora DCA Quiz Platform — Performance Indexes & Batch Scaling Migration
-- Migration: 20260922000006_performance_indexes.sql

-- 1. Profiles Table Indexes for Quick Role Filtering, Username Lookups, and Auth Linkage
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);

-- 2. Papers Table Indexes for Quick Status & Access Code Querying
CREATE INDEX IF NOT EXISTS idx_papers_status ON public.papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_access_code ON public.papers(access_code);

-- 3. Exam Attempts Table Indexes for User/Paper Querying and Realtime Proctoring
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_paper ON public.exam_attempts(user_id, paper_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);

-- 4. Answers Table Index for Rapid Attempt Score Calculation & Question Verification
CREATE INDEX IF NOT EXISTS idx_answers_attempt_question ON public.answers(attempt_id, question_id);

-- 5. Proctor Events Index for Fast Integrity Timeline Retrieval
CREATE INDEX IF NOT EXISTS idx_proctor_events_attempt_time ON public.proctor_events(attempt_id, event_time);
