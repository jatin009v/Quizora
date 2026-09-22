-- Quizora DCA Quiz Platform Database Architecture (Step 4 Migration)
-- PostgreSQL Migration Script for Paper Publishing & Access Code Security

-- 1. UNIQUE INDEX ON ACCESS_CODE TO PREVENT DUPLICATES
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_access_code 
ON public.papers (access_code) 
WHERE access_code IS NOT NULL;

-- 2. INDEX FOR FAST STUDENT PUBLISHED PAPER SEARCH BY ACCESS CODE
CREATE INDEX IF NOT EXISTS idx_papers_published_lookup 
ON public.papers (status, access_code);

-- 3. RLS POLICY FOR STUDENTS TO ACCESS PUBLISHED PAPERS
CREATE POLICY "Students can view published papers by access code" ON public.papers
    FOR SELECT USING (
        status = 'PUBLISHED' AND
        (start_at IS NULL OR NOW() >= start_at) AND
        (end_at IS NULL OR NOW() <= end_at)
    );
