-- Step 6 Migration: RLS Final Audit, Security Hardening & High-Concurrency Performance Indexes

-- 1. Performance Composite Indexes for 200+ Concurrent Exam Takers & Proctor Queries
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_status ON public.exam_attempts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_answers_attempt_updated ON public.answers(attempt_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_proctor_events_paper_time ON public.proctor_events(paper_id, event_time);
CREATE INDEX IF NOT EXISTS idx_profiles_username_status ON public.profiles(username, status);
CREATE INDEX IF NOT EXISTS idx_papers_status_access ON public.papers(status, access_code) WHERE status = 'PUBLISHED';

-- 2. Audit & Ensure RLS Enforcement on All 8 Schema Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Additional Guard Policy: Block Disabled Profiles from Querying Tables
CREATE OR REPLACE FUNCTION public.is_active_profile(profile_auth_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE auth_user_id = profile_auth_id
        AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
