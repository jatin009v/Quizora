-- Step 5 Migration: Proctor Events Schema Extensions & Indexes

-- 1. Add WINDOW_FOCUS and EXAM_REOPENED to proctor_event_type enum if not already present
ALTER TYPE proctor_event_type ADD VALUE IF NOT EXISTS 'WINDOW_FOCUS';
ALTER TYPE proctor_event_type ADD VALUE IF NOT EXISTS 'EXAM_REOPENED';

-- 2. Create additional performance indexes for Proctor Monitoring & Filtering
CREATE INDEX IF NOT EXISTS idx_proctor_events_user_id ON public.proctor_events(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_paper_status ON public.exam_attempts(paper_id, status);
