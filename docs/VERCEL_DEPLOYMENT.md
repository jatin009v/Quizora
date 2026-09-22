# Quizora DCA Quiz Platform — Production Vercel Deployment Guide

This guide details the steps to deploy **Quizora DCA** to **Vercel** for production execution supporting 200+ concurrent examination candidates.

---

## 1. Prerequisites & Environment Variables

Create a Vercel project linked to your GitHub/GitLab repository.

### Configured Environment Variables in Vercel Dashboard

Navigate to **Project Settings** → **Environment Variables** and set:

| Variable Name | Environment | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production / Preview / Dev | Public URL of Supabase project (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production / Preview / Dev | Public client anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Preview (Server Only) | **STRICTLY SERVER-SIDE ONLY** Service Role key for admin & proctor actions |

> [!CAUTION]
> NEVER check `SUPABASE_SERVICE_ROLE_KEY` into Git repositories or expose it in `NEXT_PUBLIC_` prefixed variables.

---

## 2. Build & Runtime Configuration

- **Framework Preset**: Next.js
- **Node.js Version**: `20.x` or higher
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

---

## 3. Database Migration Execution

Before completing Vercel deployment, apply all 5 SQL migrations to your Supabase PostgreSQL instance in order:

1. `supabase/migrations/20260922000000_initial_schema.sql` (8 Tables, Initial ENUMs & RLS)
2. `supabase/migrations/20260922000001_step2_enhancements.sql` (Marking Modes, Numeric Precision, Leaderboard Indexes)
3. `supabase/migrations/20260922000002_step4_access_codes.sql` (Cryptographic Access Code Unique Index)
4. `supabase/migrations/20260922000003_step5_proctor_events.sql` (Proctor ENUM additions & Monitoring Indexes)
5. `supabase/migrations/20260922000004_step6_security_hardening.sql` (Composite Indexes & RLS Hardening)

Execution can be completed via **Supabase Dashboard** → **SQL Editor** or using the Supabase CLI (`supabase db push`).

---

## 4. Post-Deployment Verification (Smoke Test)

After Vercel deployment completes:

1. Open production deployment URL (e.g. `https://quizora.vercel.app`).
2. Log in with Admin credentials (`admin` / `admin123` or custom seed).
3. Access `/admin/papers`, create a 50-question paper, configure total marks, and click **Publish Quiz**.
4. Log in as Student, enter the generated Access Code (e.g. `DCA-7K4P9X`), request fullscreen, and verify immediate per-option answer saving (`Saved ✓`).
5. Open `/proctor` in a separate browser window with Proctor credentials to verify live monitoring metrics and event logging.

---

## 5. Rollback Procedure

If a build regression occurs:

1. Open **Vercel Dashboard** → **Deployments**.
2. Find the previous stable build deployment.
3. Click the three dots menu `(...)` → Select **Promote to Production**.
4. Instant rollback completes in under 5 seconds.
