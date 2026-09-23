-- Migration: Paper-Centric Question Architecture & Access Code Control
-- Add paper_id to questions table and backfill existing question linkages

-- 1. Add paper_id column to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE;

-- 2. Backfill paper_id for existing questions from paper_questions table
UPDATE public.questions q
SET paper_id = pq.paper_id
FROM public.paper_questions pq
WHERE q.id = pq.question_id
  AND q.paper_id IS NULL;

-- 3. Create index for fast query performance on paper-centric questions
CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON public.questions(paper_id);

-- 4. Create partial unique index on access_code for published papers
CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_unique_published_access_code 
ON public.papers (UPPER(access_code)) 
WHERE status = 'PUBLISHED' AND access_code IS NOT NULL AND access_code != '';
