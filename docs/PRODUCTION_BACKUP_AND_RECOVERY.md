# Quizora DCA Quiz Platform — Production Backup & Disaster Recovery Guide

This document defines the production backup strategy, data retention policy, and emergency disaster recovery procedures for the **Quizora DCA Quiz Platform**.

---

## 1. Production Database Architecture & Backup Policy

The platform uses **Supabase PostgreSQL** as its primary persistence engine. The schema consists of 8 core tables:

1. `profiles` — Student, Proctor, and Admin accounts & metadata.
2. `questions` — Master MCQ question bank and grading options.
3. `papers` — Examination papers, custom marks, duration, and status.
4. `paper_questions` — Question assignments and ordering per paper.
5. `exam_attempts` — Student exam attempt sessions, status (`IN_PROGRESS`, `LOCKED`, `SUBMITTED`), timer stamps, and scores.
6. `answers` — Per-option immediate student answer records with idempotent `(attempt_id, question_id)` unique constraint.
7. `proctor_events` — Real-time browser integrity event audit trail (`TAB_SWITCH`, `FULLSCREEN_EXIT`, `EXAM_LOCKED`, `EXAM_REOPENED`).
8. `admin_audit_logs` — Administrative actions log (`USER_CREATED`, `PAPER_PUBLISHED`, etc.).

### Automated Backup Schedule
- **Point-In-Time Recovery (PITR)**: Enabled on Supabase Production instance (enables restoring to any second within the last 7 to 30 days).
- **Daily Automated Physical Snapshots**: Generated at 02:00 UTC daily and retained for 30 days.
- **Pre-Exam Manual Export**: Administrators must trigger a manual database dump prior to publishing any live college exam.

---

## 2. Emergency Disaster Recovery Procedures

### Scenario A: Accidental Data Corruption or Erroneous Administration
If an administrator accidentally deletes or corrupts paper configurations or user profiles:

1. **Access Supabase Dashboard** → Select **Database** → **Backups**.
2. **Select PITR Point**: Choose the precise timestamp (e.g. 1 minute prior to the accidental change).
3. **Execute Restore**: Initiate Point-In-Time Recovery. Supabase spins up a restored database instance.
4. **Verify Integrity**: Confirm that `exam_attempts` and `answers` match pre-incident counts.

### Scenario B: Temporary Database Service Disruption
If the database provider experiences a transient connection timeout during an ongoing exam:

1. **Client-Side Queue Resilience**: The Quizora client answer queue engine (`lib/exam/answerQueue.ts`) automatically intercepts HTTP 5xx errors and queues unsaved answers into memory with retry backoff.
2. **Zero Data Loss on Reconnect**: As soon as connection is re-established, the queue automatically flushes all pending answers to `POST /api/exam/answers`.
3. **State Recovery on Reload**: If a student refreshes their browser, `GET /api/exam/attempt/[attemptId]` fetches the latest server-stamped attempt state and restores all previously saved answers.

---

## 3. Manual Database Export Command (pg_dump)

To perform a manual CLI backup of the production database prior to an exam session:

```bash
pg_dump -h db.YOUR_SUPABASE_PROJECT.supabase.co -U postgres -d postgres -F c -b -v -f quizora_pre_exam_backup.dump
```

To restore from a dump file:

```bash
pgrestore -h db.YOUR_SUPABASE_PROJECT.supabase.co -U postgres -d postgres -v quizora_pre_exam_backup.dump
```
