-- Quizora DCA Quiz Platform Database Architecture (Step 2 Migration)
-- PostgreSQL Migration Script for Marking System, Leaderboard, and Admin Paper Builder

-- 1. ADD MARKING_MODE ENUM
DO $$ BEGIN
    CREATE TYPE marking_mode AS ENUM ('EQUAL_MARKS', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ALTER PAPERS TABLE TO ADD MARKING_MODE
ALTER TABLE public.papers 
ADD COLUMN IF NOT EXISTS marking_mode marking_mode NOT NULL DEFAULT 'EQUAL_MARKS',
ADD COLUMN IF NOT EXISTS required_question_count INTEGER NOT NULL DEFAULT 50;

-- 3. ENSURE NUMERIC PRECISION FOR MARKS & SCORES (Avoid floating point errors)
ALTER TABLE public.paper_questions 
ALTER COLUMN marks TYPE NUMERIC(6,2);

ALTER TABLE public.answers 
ALTER COLUMN marks_awarded TYPE NUMERIC(6,2);

ALTER TABLE public.exam_attempts 
ALTER COLUMN score TYPE NUMERIC(6,2);

-- 4. HIGH-PERFORMANCE LEADERBOARD INDEX
CREATE INDEX IF NOT EXISTS idx_exam_attempts_leaderboard 
ON public.exam_attempts (paper_id, status, score DESC, submitted_at ASC);

-- 5. UPDATE RLS POLICIES FOR ADMIN PAPER MANAGEMENT
CREATE POLICY "Admins can create and update papers" ON public.papers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage paper questions" ON public.paper_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role = 'ADMIN'
        )
    );
