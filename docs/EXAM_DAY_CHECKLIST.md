# Quizora DCA Quiz Platform — Exam-Day Administrator Checklist

This document provides a practical, step-by-step operational checklist for administrators and proctors conducting a live examination with **200+ concurrent students**.

---

## 🕒 1. T-24 Hours (Day Before Exam Checklist)

- [ ] **Database Health Verification**: Log into Supabase Console. Verify database CPU utilization < 10% and connection pool limit is configured for at least 100 connections.
- [ ] **Vercel Production Deployment**: Confirm latest Vercel production deployment build status is `Ready` (Green) with zero errors.
- [ ] **Run High-Concurrency Load Test**: Run `npm run loadtest` locally to verify 200 concurrent student performance (100% success rate required).
- [ ] **Student Account Import**: Import student roster via `/admin/users/import`. Verify zero duplicate roll numbers or usernames exist.
- [ ] **Question Bank Audit**: Review question text, code snippets, option A–D values, and sensitive `correct_option` settings for all 50 questions.
- [ ] **Paper Publishing**: Publish examination paper (`/admin/papers`). Copy generated access code (e.g. `DCA-7K4P9X`).

---

## 🕒 2. T-15 Minutes (Pre-Exam Setup Checklist)

- [ ] **Proctor Station Initialization**: Proctors log in and open `/proctor` on monitoring terminals. Verify live auto-refresh (5s interval) is active.
- [ ] **Admin Station Readiness**: Administrator opens `/admin/papers` and `/admin/users` on secondary monitor.
- [ ] **Access Code Announcement**: Write access code clearly on classroom board or distribute via secure proctor announcement.
- [ ] **Browser Requirement Reminder**: Instruct all candidates to use modern Chromium/Firefox browsers with JavaScript and Fullscreen permissions enabled.

---

## 🕒 3. T-00 (Exam Start & Live Execution Checklist)

- [ ] **Monitor Active Candidates**: Observe `/proctor` dashboard metric card `"Active Students"` scaling up to 200.
- [ ] **Track Warning Counters**: Monitor candidates entering `WARNING` status (1 or 2 integrity events).
- [ ] **Handle Locked Attempts**: If a candidate reaches 3 violations, review their timeline on `/proctor/attempts/[attemptId]`. If cleared by proctor, click **Reopen Exam** to resume their attempt.
- [ ] **Monitor Auto-Save Metrics**: Confirm network sync status remains `Saved ✓` across student terminals.

---

## 🕒 4. Post-Exam Checklist (T+60 Minutes)

- [ ] **Submission Count Verification**: Verify `Submitted` count matches the total candidate roster (e.g. 200/200).
- [ ] **Verify Score Calculations**: Open `/admin/papers/[paperId]/results`. Confirm server-calculated scores, percentages, and tie-breaking ranks.
- [ ] **Export Results & Audit Logs**: Download CSV results report and audit logs for institutional archive.
- [ ] **Archive Paper**: Transition paper status from `PUBLISHED` to `ARCHIVED` to prevent late submissions.
