-- Migration: Make paper_questions the authoritative paper-owned question snapshot record
-- Allows every paper to own its question content directly without global question bank dependency.

-- 1. Add question content columns to paper_questions table
ALTER TABLE public.paper_questions 
ADD COLUMN IF NOT EXISTS question_text TEXT,
ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'MCQ_SINGLE',
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS option_a TEXT,
ADD COLUMN IF NOT EXISTS option_b TEXT,
ADD COLUMN IF NOT EXISTS option_c TEXT,
ADD COLUMN IF NOT EXISTS option_d TEXT,
ADD COLUMN IF NOT EXISTS correct_option TEXT,
ADD COLUMN IF NOT EXISTS explanation TEXT,
ADD COLUMN IF NOT EXISTS code_snippet TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Make question_id column nullable so new paper-specific questions do not require global question FK
ALTER TABLE public.paper_questions 
ALTER COLUMN question_id DROP NOT NULL;

-- 3. Backfill question content into paper_questions from questions table for all existing linkages
UPDATE public.paper_questions pq
SET 
  question_text = q.question_text,
  question_type = COALESCE(q.question_type, 'MCQ_SINGLE'),
  difficulty = COALESCE(q.difficulty, 'MEDIUM'),
  option_a = q.option_a,
  option_b = q.option_b,
  option_c = q.option_c,
  option_d = q.option_d,
  correct_option = q.correct_option,
  explanation = q.explanation,
  code_snippet = q.code_snippet,
  image_url = q.image_url,
  marks = COALESCE(pq.marks, q.marks, 1),
  updated_at = NOW()
FROM public.questions q
WHERE pq.question_id = q.id
  AND pq.question_text IS NULL;

-- 4. Create index for fast lookup of paper-centric questions
CREATE INDEX IF NOT EXISTS idx_paper_questions_paper_order 
ON public.paper_questions (paper_id, question_order);
