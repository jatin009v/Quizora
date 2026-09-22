# Quizora DCA Quiz Platform — Master Operating Guide & Platform Manual

Welcome to the **Quizora DCA Quiz Platform** operational manual. This document provides step-by-step instructions on running the entire platform, configuring environment credentials, executing database migrations, and operating all user portals (Admin, Proctor, and Student).

---

## 1. Executive System Architecture

Quizora is a production-grade, highly resilient online examination platform designed to support **200+ concurrent examination candidates** and **50+ MCQ questions** with zero data loss.

### Core Architecture Highlights
* **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
* **Database & Identity**: Supabase PostgreSQL + Supabase Auth
* **Security & Auth Model**: Synthetic identity mapping (`username@auth.quizora.internal`), server-side RLS policies, and server-authoritative scoring.
* **Resilience Engine**: Immediate per-option answer autosave, local storage offline fallback, 3-violation proctor lockout engine, and deterministic score tie-breaking (`score DESC`, `submitted_at ASC`, `id ASC`).

---

## 2. Environment Credentials & `.env.local` Setup

The application is configured in `.env.local` using production Supabase credentials:

```env
# Supabase Project Credentials (Client Public Keys)
NEXT_PUBLIC_SUPABASE_URL=https://joofcybqoztrhkfjebbc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_coeUyVy8tGGOTqaIgpXkEg_uzmn7HuV
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_coeUyVy8tGGOTqaIgpXkEg_uzmn7HuV

# Supabase Service Role Key (Server-Side Secret — NEVER expose to client bundles)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_kPSJjS4tCshtblRkRsx2Fw_3SoGM440
```

### Key Differences & Usage:
1. **Publishable Key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)**: Used in client-side browser components for safe public interactions.
2. **Anon Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)**: Kept in sync with the publishable key for backward compatibility across Supabase SDK versions.
3. **Secret Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)**: Used strictly in server-side API routes (`lib/supabase/admin.ts`) to manage user accounts, perform administrative audit logging, and bypass RLS for administrative actions.

---

## 3. Database Migration & Seed Setup

Before launching the application for the first time, execute the SQL migration scripts in your Supabase SQL Editor.

### Step 3.1: Execute Database Migrations (In Order)
Navigate to **Supabase Dashboard → SQL Editor** and execute the following scripts located in `supabase/migrations/`:

1. [`20260922000000_initial_schema.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/supabase/migrations/20260922000000_initial_schema.sql) — Core tables, enums, indexes, and initial RLS policies.
2. [`20260922000001_step2_enhancements.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/supabase/migrations/20260922000001_step2_enhancements.sql) — Scoring, completion time calculations, and tie-breaker views.
3. [`20260922000002_step4_access_codes.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/supabase/migrations/20260922000002_step4_access_codes.sql) — Access code rate limiting and exam publish fields.
4. [`20260922000003_step5_proctor_events.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/supabase/migrations/20260922000003_step5_proctor_events.sql) — Proctor monitoring event schema and lockout policies.
5. [`20260922000004_step6_security_hardening.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/supabase/migrations/20260922000004_step6_security_hardening.sql) — High-concurrency performance indexes and security constraints.

### Step 3.2: Seed Initial Data
Execute the seed script [`supabase/seed.sql`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/supabase/seed.sql) in the Supabase SQL Editor to populate:
* Default **Admin** and **Proctor** profile records.
* Sample **MCQ Question Bank** (Computer Science & Networking).
* Sample Published Exam Paper (`DCA Computer Science Certification Exam 2026`).
* Sample Exam **Access Code**: `DCA2026`.

---

## 4. How to Run the Platform

### Command Quick Reference

| Action | Terminal Command | Description |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm install` | Installs Next.js, React, Supabase SDK, Vitest, and dependencies |
| **Local Development** | `npm run dev` | Launches local server at `http://localhost:3000` |
| **Type Check** | `npm run typecheck` | Validates TypeScript types across the entire codebase |
| **Run Unit Tests** | `npm test` or `npx vitest run` | Runs full 74-test verification suite |
| **Production Build** | `npm run build` | Compiles optimized Next.js production build |
| **Production Launch** | `npm start` | Runs production server |
| **High-Load Simulation** | `npx ts-node load-tests/loadtest.ts` | Runs 200 concurrent user simulation test |

---

## 5. User Portals & Step-by-Step Usage Guide

### 🔑 Authentication System
* **Login Route**: `/login` (or root `/`)
* **Username Sign-In**: Candidates and admins log in using a simple **Username** and **Password**.
* **Synthetic Identity**: The system transparently maps `username` to `username@auth.quizora.internal` for Supabase Auth identity verification.

---

### 👑 1. Admin Portal (`/admin`)

The Admin Portal is accessible to users with the `ADMIN` role.

#### A. Admin Dashboard (`/admin`)
* View platform metrics: total students, active papers, total questions, and completed attempts.
* Quick action shortcuts to user creation, question bank management, and paper creation.

#### B. User Management (`/admin/users`)
* **Manual User Creation**: Create individual Student, Proctor, or Admin accounts specifying Name, Course, Roll Number, Username, and Password.
* **Bulk Excel Import**: Download the official Excel template, populate candidate rows, and upload to perform a two-phase transactional bulk account creation.
* **Account Control**: Toggle user status (`ACTIVE` / `DISABLED`) to instantly allow or revoke platform access.

#### C. Question Bank (`/admin/questions`)
* Create questions with customizable text, code snippets, difficulty level (`EASY`, `MEDIUM`, `HARD`), marks, explanation, options (A, B, C, D), and correct answer.
* Filter and search questions by course or keyword.

#### D. Paper Builder (`/admin/papers`)
* **Draft Papers**: Construct exam papers with title, course description, and duration in minutes.
* **Question Selection**: Select questions from the question bank and assign custom per-question marks.
* **Paper Publishing**: Generate a 6 to 8-character cryptographically secure **Access Code** (e.g., `DCA2026`) and set exam start/end window.

#### E. Results & Analytics (`/admin/results`)
* View real-time exam attempt submissions.
* Inspect candidate total scores, percentage, time taken, and server-authoritative leaderboard rankings.

---

### 🛡️ 2. Proctor Portal (`/proctor`)

The Proctor Portal is accessible to users with `PROCTOR` or `ADMIN` roles.

#### A. Candidate Live Monitoring
* Real-time grid of all students currently taking an active exam paper.
* Displays live metrics: Student Name, Roll Number, Current Question Index, Tab Switch Count, and Fullscreen Exit Count.

#### B. Violation Tracking & Lockout Engine
* The system tracks 3 integrity violation types: `TAB_SWITCH`, `WINDOW_BLUR`, and `FULLSCREEN_EXIT`.
* On the **3rd violation**, the system automatically locks the attempt, preventing further answer submission.

#### C. Proctor Lock & Reopen Engine
* **Manual Lock**: Proctors can manually lock suspicious candidates with one click.
* **Attempt Reopen**: Proctors can inspect the full candidate event timeline and click **Reopen Attempt**.
* **Preservation Guarantee**: Reopening an attempt preserves candidate **Attempt ID**, **Saved Answers**, **Current Question Index**, and **Remaining Timer Countdown**.

---

### 🎓 3. Student Portal (`/student`)

The Student Portal is accessible to users with the `STUDENT` role.

#### A. Student Dashboard (`/student`)
* Lists all available published exam papers assigned to the student's course.

#### B. Exam Access Code Entry
* Clicking **Start Exam** prompts the candidate to enter the official exam **Access Code** (e.g., `DCA2026`).
* Security controls prevent brute-force code guessing with sliding-window rate limiting.

#### C. Live Exam Runner (`/student/exam/[paperId]`)
* **Fullscreen Requirement**: Exam opens in enforced fullscreen mode. Exiting fullscreen triggers a proctor integrity warning.
* **Server-Authoritative Countdown**: Timer counts down from server-allocated `expires_at` timestamp.
* **Immediate Answer Auto-Save**: Clicking option A, B, C, or D triggers an immediate per-option background persist to the database.
* **Offline Resilience**: If network fails, answers queue locally and automatically sync upon reconnection.
* **State Recovery**: Refreshing or re-logging in returns the student directly to their active question and saved answers.

#### D. Student Result Page (`/student/results/[attemptId]`)
* Displays final calculated score, total possible marks, percentage, completion duration, and ranked position on the leaderboard.

---

## 6. Credentials Quick Reference Table

| Role | Username | Password | Accessible Routes | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | *(Set via Supabase/API)* | `/admin`, `/proctor`, `/student` | User creation, paper building, results analytics |
| **Proctor** | `proctor` | *(Set via Supabase/API)* | `/proctor` | Live candidate monitoring, violation audit, lock/reopen |
| **Student** | `student1` | *(Set via Supabase/API)* | `/student`, `/student/exam/*` | Taking exam, viewing scores & leaderboard |

*Note: For testing in local offline development, demo mode falls back to synthetic mock profiles if Supabase is unseeded.*

---

## 7. Operations & Emergency Documentation Index

For production deployment and exam-day operations, refer to the operational documentation in the [`docs/`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/docs) directory:

1. **Exam Emergency Runbook**: [`docs/EXAM_EMERGENCY_RUNBOOK.md`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/docs/EXAM_EMERGENCY_RUNBOOK.md) — Step-by-step procedures for handling network drops, candidate locks, and power outages.
2. **Release Candidate Report**: [`docs/RELEASE_CANDIDATE_REPORT.md`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/docs/RELEASE_CANDIDATE_REPORT.md) — Step 7 verification report and system audit metrics.
3. **Exam-Day Checklist**: [`docs/EXAM_DAY_CHECKLIST.md`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/docs/EXAM_DAY_CHECKLIST.md) — Pre-exam operational checklist for proctors and IT administrators.
4. **Production Backup & Recovery**: [`docs/PRODUCTION_BACKUP_AND_RECOVERY.md`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/docs/PRODUCTION_BACKUP_AND_RECOVERY.md) — Database backup strategies and recovery workflows.
5. **Vercel Deployment Guide**: [`docs/VERCEL_DEPLOYMENT.md`](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/docs/VERCEL_DEPLOYMENT.md) — Environment variable mapping and production deployment instructions.
