# Quizora DCA Quiz Platform — Exam Emergency Operational Runbook

This operational runbook provides step-by-step resolution procedures for 13 critical emergency scenarios during a live examination.

> [!CAUTION]
> **CRITICAL RULE**: NEVER manually edit database timestamps (`started_at`, `expires_at`, `submitted_at`) or modify candidate answers directly in PostgreSQL to grant extra time or points. All recovery procedures must follow server-authoritative workflows.

---

## 🚨 Scenario 1: Student Cannot Login

### Symptoms
Candidate enters username & password on `/login` and receives `"Invalid username or password"` or `"Account is disabled"`.

### Step-by-Step Resolution
1. **Verify Credentials**: Check if the student is using their assigned username (e.g. `student101`) rather than an external email address.
2. **Check Account Status**: Administrator opens `/admin/users` and searches for the student's username or roll number.
3. **If Account is Disabled**: Click **Enable User** toggle to restore `status = 'ACTIVE'`.
4. **If Password is Lost**: Administrator opens user detail on `/admin/users` and executes password reset. Candidate logs in again.

---

## 🚨 Scenario 2: Access Code Does Not Work

### Symptoms
Candidate enters access code on `/student` and receives `"Invalid or unavailable exam code"`.

### Step-by-Step Resolution
1. **Verify Code Formatting**: Access codes are uppercase and case-insensitive (e.g. `DCA-7K4P9X`). Hyphens and spaces are automatically normalized by the server.
2. **Verify Paper Status**: Administrator opens `/admin/papers` and confirms paper status is **PUBLISHED** (Draft or Archived papers are hidden from candidates).
3. **Verify Exam Schedule**: Confirm current server time is between paper `start_at` and `end_at`. If `start_at` is in the future, candidates cannot start until the scheduled time.

---

## 🚨 Scenario 3: Exam Page Fails to Load

### Symptoms
Candidate enters access code, clicks Start Exam, but browser shows a white screen or network timeout.

### Step-by-Step Resolution
1. **Verify Network Connectivity**: Check candidate's Wi-Fi / Ethernet connection.
2. **Browser Reload**: Instruct candidate to press `F5` or `Ctrl + R` (Cmd + R on Mac).
3. **State Recovery**: The system automatically executes `createOrRecoverExamAttempt` (`GET /api/exam/attempt/[attemptId]`). It recovers the candidate's existing `IN_PROGRESS` attempt, restores saved answers, and syncs the authoritative remaining timer.

---

## 🚨 Scenario 4: Answer Appears Unsaved (`PENDING_RETRY`)

### Symptoms
Sync status pill displays `"Network issue, pending retry..."` in yellow/orange.

### Step-by-Step Resolution
1. **Do NOT Close Browser**: Instruct candidate to keep the exam window open and continue attempting questions.
2. **Automatic Background Retry**: The client-side persistence queue engine (`lib/exam/answerQueue.ts`) automatically retries unsaved answers in background exponential backoff.
3. **Verify Recovery**: Once network connection restores, sync status automatically transitions back to green `Saved ✓`.

---

## 🚨 Scenario 5: Student Loses Internet Connection

### Symptoms
Wi-Fi drops on candidate terminal during exam.

### Step-by-Step Resolution
1. **Local Queue In-Memory Preservation**: All options selected during offline window remain saved in local component state and queue retry buffer.
2. **Reconnect Network**: Reconnect candidate device to college Wi-Fi or backup hotspot.
3. **Automatic Flush**: Upon reconnection, queued answers are sent sequentially to `POST /api/exam/answers`.

---

## 🚨 Scenario 6: Student Laptop Restarts or Power Off

### Symptoms
Candidate's laptop battery dies or OS crashes mid-exam.

### Step-by-Step Resolution
1. **Restart Device & Browser**: Candidate powers on device, opens browser, and navigates to `https://quizora.vercel.app/login`.
2. **Log In & Re-enter Code**: Candidate logs in, enters access code, and clicks **Start Exam**.
3. **Exact Recovery**: Server detects candidate has an active `IN_PROGRESS` attempt ID. Candidate resumes at their exact `last_question_index` with all previously saved answers intact and remaining timer calculated from original `expires_at`.

---

## 🚨 Scenario 7: Student Gets Locked (3 Integrity Violations)

### Symptoms
Candidate screen displays dark lockout modal: `"Your examination has been temporarily locked. Please contact the exam proctor."`

### Step-by-Step Resolution
1. **Candidate Action**: Candidate raises hand and informs proctor. Candidate must NOT close browser.
2. **Proctor Action**: Proctor opens `/proctor`, finds student row (marked with red `LOCKED` badge), and clicks **Timeline**.
3. **Review Audit Log**: Proctor inspects event timeline (`TAB_SWITCH`, `FULLSCREEN_EXIT`).
4. **Execute Reopen**: If candidate's explanation is accepted, proctor clicks **Reopen Exam Attempt** and confirms modal.
5. **Auto-Resume**: Candidate's screen automatically unfreezes within 3–5 seconds, resuming the exam at the exact question index with answers intact.

---

## 🚨 Scenario 8: Proctor Needs to Manually Lock Attempt

### Symptoms
Proctor physically observes candidate using prohibited materials or external device.

### Step-by-Step Resolution
1. **Proctor Dashboard**: Proctor opens candidate's detail page (`/proctor/attempts/[attemptId]`).
2. **Click Lock Attempt**: Proctor clicks **Lock Attempt**, enters reason (e.g. `"Physical proctor observation of prohibited material"`), and confirms modal.
3. **Immediate Lock**: Candidate's exam runner immediately transitions to `LOCKED` state (`HTTP 423`), disabling answer selection.

---

## 🚨 Scenario 9: Exam Timer Appears Incorrect on Student Device

### Symptoms
Candidate claims browser timer shows different time than clock on wall.

### Step-by-Step Resolution
1. **Server-Authoritative Timing Explanation**: Inform candidate that `expires_at` was stamped by the server when the exam started (`started_at + duration_minutes`). Changing device clock or browser DevTools has zero effect on server timer.
2. **Check Expiration Time**: Proctor opens `/proctor/attempts/[attemptId]` to view exact server `expires_at` timestamp.

---

## 🚨 Scenario 10: Vercel Deployment Failure / Outage

### Symptoms
Vercel production deployment returns HTTP 502 / 503 error.

### Step-by-Step Resolution
1. **Vercel Dashboard**: Log into Vercel Console → Select **Quizora** project → **Deployments**.
2. **Promote Stable Build**: Select previous successful production deployment → Click **Promote to Production**. Rollback completes in < 5 seconds.

---

## 🚨 Scenario 11: Supabase Database Temporary Outage

### Symptoms
Database queries fail with connection refusal.

### Step-by-Step Resolution
1. **Instruct Candidates**: Instruct candidates to remain on exam runner page and not refresh.
2. **Queue Protection**: Unsaved answer clicks are stored safely in client memory buffer.
3. **Database Recovery**: Once Supabase connection restores, client queue flushes unsaved answers automatically.

---

## 🚨 Scenario 12: Accidental Paper Configuration Error

### Symptoms
Administrator discovers incorrect question assigned or wrong total marks after paper is published.

### Step-by-Step Resolution
1. **If Exam Not Started**: Administrator updates paper status back to `DRAFT`, edits question assignments/marks, and re-publishes.
2. **If Exam In Progress**: Do NOT unpublish an in-progress paper. Let candidates complete exam. Administrator can adjust marks or apply custom marking mode after exam completion before finalizing results.

---

## 🚨 Scenario 13: Emergency Exam Cancellation

### Symptoms
Major facility emergency requiring immediate examination termination.

### Step-by-Step Resolution
1. **Admin Action**: Administrator opens `/admin/papers`, selects paper, and updates status to **ARCHIVED**.
2. **Bulk Lock**: All active attempts immediately reject further answer submissions (`HTTP 409`).
3. **Data Preservation**: All answers submitted up to the moment of cancellation remain 100% saved in PostgreSQL for institutional review.
