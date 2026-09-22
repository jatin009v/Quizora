# Quizora DCA Quiz Platform — Supabase Database Architecture & Schema Specification

This document provides a comprehensive specification of the **Quizora DCA Online Examination Platform** database schema deployed on Supabase PostgreSQL.

---

## 1. Overview & Entity Relationship Diagram (ERD)

```
   ┌──────────────┐          ┌────────────────┐          ┌──────────────┐
   │   profiles   │◄─────────┤  exam_attempts │─────────►│    papers    │
   └──────┬───────┘          └───────┬────────┘          └──────┬───────┘
          │                          │                          │
          │                          ▼                          ▼
          │                  ┌───────────────┐          ┌───────────────┐
          └─────────────────►│ proctor_events│          │paper_questions│
                             └───────────────┘          └──────┬────────┘
                                     │                         │
                                     ▼                         ▼
                             ┌───────────────┐          ┌───────────────┐
                             │    answers    ├─────────►│   questions   │
                             └───────────────┘          └───────────────┘
```

---

## 2. Table Specifications

### 1. `public.profiles`
Stores user profile information, role classification, course metadata, and linkage to `auth.users`.

* **Primary Key**: `id` (UUID)
* **Foreign Keys**: `auth_user_id` → `auth.users(id)` ON DELETE CASCADE
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `auth_user_id`: UUID (Nullable for synthetic local mapping)
  - `name`: VARCHAR(255) NOT NULL
  - `course`: VARCHAR(100) NOT NULL
  - `roll_number`: VARCHAR(100) NOT NULL
  - `username`: VARCHAR(100) UNIQUE NOT NULL
  - `role`: `user_role` ENUM (`ADMIN`, `PROCTOR`, `STUDENT`)
  - `status`: `user_status` ENUM (`ACTIVE`, `DISABLED`)
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **Unique Constraints**: `UNIQUE(username)`
* **Indexes**: `idx_profiles_username_status` (`username`, `status`)
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Profiles are viewable by owners and staff`: Owners (`auth.uid() = auth_user_id`) and staff (`role IN ('ADMIN', 'PROCTOR')`).

---

### 2. `public.questions`
Stores MCQ questions, options, difficulty level, marks, explanation, and correct answer (server-side grading data).

* **Primary Key**: `id` (UUID)
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `question_text`: TEXT NOT NULL
  - `question_type`: `question_type` ENUM (`MCQ_SINGLE`, `MCQ_MULTIPLE`) DEFAULT `MCQ_SINGLE`
  - `difficulty`: `difficulty_level` ENUM (`EASY`, `MEDIUM`, `HARD`) DEFAULT `MEDIUM`
  - `option_a`: TEXT NOT NULL
  - `option_b`: TEXT NOT NULL
  - `option_c`: TEXT NOT NULL
  - `option_d`: TEXT NOT NULL
  - `correct_option`: VARCHAR(10) NOT NULL (*Sensitive — Never returned in student APIs*)
  - `explanation`: TEXT
  - `code_snippet`: TEXT
  - `image_url`: TEXT
  - `marks`: INTEGER NOT NULL DEFAULT 1
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Admins and Proctors can manage questions`: Restricted to `ADMIN` and `PROCTOR` roles. Student access is server-sanitized via API.

---

### 3. `public.papers`
Stores examination paper metadata, course association, duration, total marks, status, and publish access codes.

* **Primary Key**: `id` (UUID)
* **Foreign Keys**: `created_by` → `public.profiles(id)`
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `title`: VARCHAR(255) NOT NULL
  - `description`: TEXT
  - `course`: VARCHAR(100) NOT NULL
  - `duration_minutes`: INTEGER NOT NULL DEFAULT 60
  - `total_marks`: INTEGER NOT NULL DEFAULT 50
  - `status`: `paper_status` ENUM (`DRAFT`, `PUBLISHED`, `ARCHIVED`) DEFAULT `DRAFT`
  - `marking_mode`: `marking_mode` ENUM (`EQUAL_MARKS`, `CUSTOM`) DEFAULT `EQUAL_MARKS`
  - `required_question_count`: INTEGER NOT NULL DEFAULT 50
  - `access_code`: VARCHAR(50) (*Cryptographically generated 6-8 char code*)
  - `start_at`: TIMESTAMPTZ
  - `end_at`: TIMESTAMPTZ
  - `created_by`: UUID
  - `published_at`: TIMESTAMPTZ
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **Unique Constraints**: `idx_unique_access_code` ON `access_code` WHERE `access_code IS NOT NULL`
* **Indexes**: `idx_papers_published_lookup` (`status`, `access_code`), `idx_papers_status_access`
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Students can view published papers`: `status = 'PUBLISHED'` and within start/end window.
  - `Admins can create and update papers`: `role = 'ADMIN'`.

---

### 4. `public.paper_questions`
Junction table mapping questions to examination papers with question ordering and marks allocation.

* **Primary Key**: `id` (UUID)
* **Foreign Keys**:
  - `paper_id` → `public.papers(id)` ON DELETE CASCADE
  - `question_id` → `public.questions(id)` ON DELETE CASCADE
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `paper_id`: UUID NOT NULL
  - `question_id`: UUID NOT NULL
  - `question_order`: INTEGER NOT NULL
  - `marks`: NUMERIC(6,2) NOT NULL DEFAULT 1.00
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **Unique Constraints**: `UNIQUE(paper_id, question_id)`
* **Indexes**: `idx_paper_questions_paper_id`, `idx_paper_questions_question_id`
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Paper questions viewable by authenticated users`: Authenticated users can view mapping.

---

### 5. `public.exam_attempts`
Tracks individual student exam attempts, server-authoritative timer expiry, integrity violation counters, and score calculation.

* **Primary Key**: `id` (UUID)
* **Foreign Keys**:
  - `user_id` → `public.profiles(id)` ON DELETE CASCADE
  - `paper_id` → `public.papers(id)` ON DELETE CASCADE
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `user_id`: UUID NOT NULL
  - `paper_id`: UUID NOT NULL
  - `status`: `attempt_status` ENUM (`NOT_STARTED`, `IN_PROGRESS`, `LOCKED`, `SUBMITTED`) DEFAULT `NOT_STARTED`
  - `started_at`: TIMESTAMPTZ
  - `expires_at`: TIMESTAMPTZ (*Server-authoritative timer countdown*)
  - `submitted_at`: TIMESTAMPTZ
  - `locked_at`: TIMESTAMPTZ
  - `score`: NUMERIC(6,2)
  - `total_marks`: INTEGER NOT NULL DEFAULT 50
  - `tab_switch_count`: INTEGER NOT NULL DEFAULT 0
  - `fullscreen_exit_count`: INTEGER NOT NULL DEFAULT 0
  - `last_question_index`: INTEGER NOT NULL DEFAULT 0
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **Unique Constraints**: `idx_unique_active_attempt` ON `(user_id, paper_id)` WHERE `status IN ('IN_PROGRESS', 'NOT_STARTED')`
* **Indexes**:
  - `idx_exam_attempts_user_id`, `idx_exam_attempts_paper_id`, `idx_exam_attempts_user_paper`
  - `idx_exam_attempts_status`, `idx_exam_attempts_paper_status`
  - `idx_exam_attempts_leaderboard` (`paper_id`, `status`, `score DESC`, `submitted_at ASC`)
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Students can view own attempt`: Candidate or Staff.
  - `Students can update own active attempt`: Candidate when `status = 'IN_PROGRESS'`.

---

### 6. `public.answers`
Stores student per-option answer selections with single-row idempotent constraint (`UNIQUE(attempt_id, question_id)`).

* **Primary Key**: `id` (UUID)
* **Foreign Keys**:
  - `attempt_id` → `public.exam_attempts(id)` ON DELETE CASCADE
  - `question_id` → `public.questions(id)` ON DELETE CASCADE
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `attempt_id`: UUID NOT NULL
  - `question_id`: UUID NOT NULL
  - `selected_option`: VARCHAR(10) NOT NULL
  - `is_correct`: BOOLEAN (*Computed server-side upon submission*)
  - `marks_awarded`: NUMERIC(6,2)
  - `answered_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **Unique Constraints**: `UNIQUE(attempt_id, question_id)`
* **Indexes**: `idx_answers_attempt_id`, `idx_answers_attempt_question`, `idx_answers_attempt_updated`
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Students can view own answers`: Candidate attempt owner.
  - `Students can insert/update own answers during active attempt`: Candidate attempt owner when `status = 'IN_PROGRESS'` and `NOW() <= expires_at`.

---

### 7. `public.proctor_events`
Logs real-time browser integrity events (`TAB_SWITCH`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `EXAM_LOCKED`, `EXAM_REOPENED`).

* **Primary Key**: `id` (UUID)
* **Foreign Keys**:
  - `attempt_id` → `public.exam_attempts(id)` ON DELETE CASCADE
  - `user_id` → `public.profiles(id)` ON DELETE CASCADE
  - `paper_id` → `public.papers(id)` ON DELETE CASCADE
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `attempt_id`: UUID NOT NULL
  - `user_id`: UUID NOT NULL
  - `paper_id`: UUID NOT NULL
  - `event_type`: `proctor_event_type` ENUM (`TAB_SWITCH`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `FULLSCREEN_ENTER`, `EXAM_STARTED`, `EXAM_SUBMITTED`, `EXAM_LOCKED`, `RECONNECTED`, `DISCONNECTED`, `PAGE_REFRESH`, `WINDOW_FOCUS`, `EXAM_REOPENED`)
  - `event_time`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `question_index`: INTEGER DEFAULT 0
  - `metadata`: JSONB DEFAULT '{}'::jsonb
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **Indexes**: `idx_proctor_events_attempt_id`, `idx_proctor_events_event_time`, `idx_proctor_events_user_id`, `idx_proctor_events_paper_time`
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Students can log proctor events for own attempt`: Candidate attempt owner.
  - `Proctors and Admins can view proctor events`: `role IN ('ADMIN', 'PROCTOR')`.

---

### 8. `public.admin_audit_logs`
Logs administrative actions (`USER_CREATED`, `BULK_USERS_IMPORTED`, `PAPER_PUBLISHED`, `ATTEMPT_REOPENED`) omitting any sensitive secrets or passwords.

* **Primary Key**: `id` (UUID)
* **Foreign Keys**: `admin_user_id` → `public.profiles(id)` ON DELETE CASCADE
* **Columns**:
  - `id`: UUID (DEFAULT `uuid_generate_v4()`)
  - `admin_user_id`: UUID NOT NULL
  - `action`: VARCHAR(255) NOT NULL
  - `target_type`: VARCHAR(100) NOT NULL
  - `target_id`: UUID
  - `metadata`: JSONB DEFAULT '{}'::jsonb
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
* **RLS Status**: **ENABLED**
* **Policies**:
  - `Only Admins can access audit logs`: `role = 'ADMIN'`.

---

## 3. Database Functions & Triggers

### `public.is_active_profile(profile_auth_id UUID)`
SECURITY DEFINER function checking whether an authenticated user profile has status `'ACTIVE'`. Used in RLS evaluation.

---

## 4. Leaderboard Ranking Sorting Rule
To guarantee 100% deterministic leaderboard rankings across concurrent candidates:

$$\text{Sort Order} = \text{score DESC} \longrightarrow \text{submitted\_at ASC} \longrightarrow \text{id ASC}$$
