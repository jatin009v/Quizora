# ⚡ Quizora DCA — High-Concurrency Online MCQ Examination Platform (Step 1 Engine)

Quizora DCA is a production-grade online MCQ examination platform engineered for high-concurrency college environments (200+ concurrent students, 50 MCQ questions per exam, 10,000+ total active answer persistences).

Designed with a **festival/grunge-inspired editorial light theme**, GSAP-powered animations, magnetic UI elements, Supabase PostgreSQL DB architecture, immediate answer persistence, optimistic concurrency control, and strict zero-exposure of student grading data.

> 📖 **Complete Operating Guide**: For detailed platform startup, database seeding, credentials, and Admin/Proctor/Student portal guides, see [**`GUIDE.md`**](file:///c:/Users/ASUS/OneDrive/Desktop/CODE_VIDYA/Quizora/GUIDE.md).

---

## 🌟 Key Architecture & Highlights

1. **Immediate Per-Option Persistence (`Saved ✓`)**
   - Answers are saved instantly as students click options (A/B/C/D).
   - No waiting for "Next/Previous" buttons or final exam submission.
   - Client-side queue handles exponential retries during network glitches (`Pending sync...` → `Retrying...` → `Saved ✓`).

2. **Idempotent Upsert & Single-Row Guarantee**
   - Database constraint: `UNIQUE(attempt_id, question_id)`.
   - Rapid option changes (e.g. A → B → C within 300ms) resolve to exactly ONE updated row containing option `C`.
   - Timestamp sequencing prevents stale out-of-order network responses from overwriting newer user selections.

3. **Zero-Exposure Correct Answer Protection**
   - Student-facing APIs and Row-Level Security policies explicitly strip `correct_option` and `explanation`.
   - Answers remain strictly server-side for automated grading.

4. **Exam-State Recovery Engine**
   - Reloading or refreshing the browser fetches active attempt status, saved answers, remaining timer seconds, and `last_question_index` without resetting the exam.

5. **Production Supabase DB Architecture (8 Core Tables)**
   - `profiles`, `questions`, `papers`, `paper_questions`, `exam_attempts`, `answers`, `proctor_events`, `admin_audit_logs`.
   - Enabled Row-Level Security (RLS) on all tables with explicit non-wildcard policies.

---

## 📁 Project Structure

```
Quizora/
├── app/
│   ├── api/
│   │   ├── exam/
│   │   │   ├── answers/route.ts      # POST: Immediate answer saving endpoint
│   │   │   ├── progress/route.ts     # POST: Persists last_question_index
│   │   │   └── attempt/[attemptId]/  # GET: State recovery on page refresh
│   ├── globals.css                   # Editorial light design system & tokens
│   ├── layout.tsx                    # Next.js Root Layout with SEO metadata
│   └── page.tsx                      # Immersive animated landing page & live exam demo
├── components/
│   ├── exam/
│   │   └── ExamInterface.tsx         # MCQ Exam runner with instant sync indicator
│   └── ui/
│       └── MagneticButton.tsx        # GSAP-powered spring physics button
├── lib/
│   ├── auth/
│   │   └── session.ts                # Server session authentication helper
│   ├── exam/
│   │   ├── answerQueue.ts            # Client-side retry queue & status engine
│   │   └── service.ts                # Core attempt validation, upsert & state logic
│   ├── supabase/
│   │   ├── admin.ts                  # Server-only service role client
│   │   ├── client.ts                 # Browser client (@supabase/ssr)
│   │   └── server.ts                 # Server client (@supabase/ssr cookies)
│   └── validation/
│       └── exam.ts                   # Zod schemas for input validation
├── supabase/
│   └── migrations/
│       └── 20260922000000_initial_schema.sql # 8 tables, indexes, constraints & RLS
├── tests/
│   └── exam.test.ts                  # Vitest suite covering all 13 requirement cases
├── .env.example                      # Environment variables placeholder
├── vitest.config.ts                  # Test configuration with path aliases
└── package.json
```

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- Node.js 18+ (Tested on v24.21.0 / v20.18.0)
- npm 10+

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database Setup (Supabase PostgreSQL)
Execute the migration script in your Supabase SQL Editor or via Supabase CLI:
```bash
npx supabase db push
```
Or paste the contents of `supabase/migrations/20260922000000_initial_schema.sql` directly into your Supabase Dashboard SQL Editor.

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the automated verification suite covering all 13 security, concurrency, and persistence test cases:
```bash
npm run test
```

Run TypeScript strict type checking:
```bash
npm run typecheck
```

Run production build validation:
```bash
npm run build
```

---

## 🌐 Vercel Deployment Preparation

1. Push code to GitHub repository.
2. Connect repository on [Vercel](https://vercel.com).
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy with framework preset **Next.js**.

---

## 🔒 Security Summary

- **Service Role Key Security**: `SUPABASE_SERVICE_ROLE_KEY` is loaded exclusively inside `lib/supabase/admin.ts` on the server-side.
- **Client Sanitization**: Exam payload stripping ensures `correct_option` is never leaked to student network inspect tools.
- **Authorization Scoping**: All attempt operations verify `attempt.user_id === authenticated_user_id` and `attempt.status === 'IN_PROGRESS'`.
