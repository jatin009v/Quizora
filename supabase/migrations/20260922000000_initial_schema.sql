-- Quizora DCA Quiz Platform Database Architecture (Step 1 Migration)
-- PostgreSQL Migration Script for Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'PROCTOR', 'STUDENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM ('MCQ_SINGLE', 'MCQ_MULTIPLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE difficulty_level AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE paper_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE attempt_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'LOCKED', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE proctor_event_type AS ENUM (
        'TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTER',
        'EXAM_STARTED', 'EXAM_SUBMITTED', 'EXAM_LOCKED', 'RECONNECTED',
        'DISCONNECTED', 'PAGE_REFRESH'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    course VARCHAR(100) NOT NULL,
    roll_number VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    question_type question_type NOT NULL DEFAULT 'MCQ_SINGLE',
    difficulty difficulty_level NOT NULL DEFAULT 'MEDIUM',
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(10) NOT NULL, -- SENSITIVE EXAM DATA: NEVER RETURN TO CLIENT
    explanation TEXT,
    code_snippet TEXT,
    image_url TEXT,
    marks INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAPERS TABLE
CREATE TABLE IF NOT EXISTS public.papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course VARCHAR(100) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    total_marks INTEGER NOT NULL DEFAULT 50,
    status paper_status NOT NULL DEFAULT 'DRAFT',
    access_code VARCHAR(50),
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAPER_QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.paper_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    marks INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_paper_question UNIQUE (paper_id, question_id)
);

-- EXAM_ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    status attempt_status NOT NULL DEFAULT 'NOT_STARTED',
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    score NUMERIC(5,2),
    total_marks INTEGER NOT NULL DEFAULT 50,
    tab_switch_count INTEGER NOT NULL DEFAULT 0,
    fullscreen_exit_count INTEGER NOT NULL DEFAULT 0,
    last_question_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option VARCHAR(10) NOT NULL,
    is_correct BOOLEAN,
    marks_awarded NUMERIC(5,2),
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_attempt_question_answer UNIQUE (attempt_id, question_id)
);

-- PROCTOR_EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.proctor_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    event_type proctor_event_type NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    question_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ADMIN_AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE CONCURRENCY (200+ CONCURRENT EXAM TAKERS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON public.answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt_question ON public.answers(attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON public.exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_paper_id ON public.exam_attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_paper ON public.exam_attempts(user_id, paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_questions_paper_id ON public.paper_questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_questions_question_id ON public.paper_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_proctor_events_attempt_id ON public.proctor_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctor_events_event_time ON public.proctor_events(event_time);

-- Unique index to prevent duplicate active attempts for the same student & paper
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_attempt 
ON public.exam_attempts (user_id, paper_id) 
WHERE status IN ('IN_PROGRESS', 'NOT_STARTED');

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
CREATE POLICY "Profiles are viewable by owners and staff" ON public.profiles
    FOR SELECT USING (
        auth.uid() = auth_user_id OR 
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role IN ('ADMIN', 'PROCTOR')
        )
    );

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- PAPERS RLS
CREATE POLICY "Students can view published papers" ON public.papers
    FOR SELECT USING (
        status = 'PUBLISHED' OR
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role IN ('ADMIN', 'PROCTOR')
        )
    );

-- QUESTIONS RLS (Admin/Proctor full control, Students can only access via server action)
CREATE POLICY "Admins and Proctors can manage questions" ON public.questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role IN ('ADMIN', 'PROCTOR')
        )
    );

-- PAPER QUESTIONS RLS
CREATE POLICY "Paper questions viewable by authenticated users" ON public.paper_questions
    FOR SELECT USING (auth.role() = 'authenticated');

-- EXAM ATTEMPTS RLS
CREATE POLICY "Students can view own attempt" ON public.exam_attempts
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role IN ('ADMIN', 'PROCTOR')
        )
    );

CREATE POLICY "Students can update own active attempt" ON public.exam_attempts
    FOR UPDATE USING (
        user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) AND
        status = 'IN_PROGRESS'
    );

-- ANSWERS RLS
CREATE POLICY "Students can view own answers" ON public.answers
    FOR SELECT USING (
        attempt_id IN (
            SELECT ea.id FROM public.exam_attempts ea
            JOIN public.profiles p ON ea.user_id = p.id
            WHERE p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Students can insert/update own answers during active attempt" ON public.answers
    FOR ALL USING (
        attempt_id IN (
            SELECT ea.id FROM public.exam_attempts ea
            JOIN public.profiles p ON ea.user_id = p.id
            WHERE p.auth_user_id = auth.uid() AND ea.status = 'IN_PROGRESS' AND NOW() <= ea.expires_at
        )
    );

-- PROCTOR EVENTS RLS
CREATE POLICY "Students can log proctor events for own attempt" ON public.proctor_events
    FOR INSERT WITH CHECK (
        attempt_id IN (
            SELECT ea.id FROM public.exam_attempts ea
            JOIN public.profiles p ON ea.user_id = p.id
            WHERE p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Proctors and Admins can view proctor events" ON public.proctor_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role IN ('ADMIN', 'PROCTOR')
        )
    );

-- ADMIN AUDIT LOGS RLS
CREATE POLICY "Only Admins can access audit logs" ON public.admin_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.auth_user_id = auth.uid() AND p.role = 'ADMIN'
        )
    );
