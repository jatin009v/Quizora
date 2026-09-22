# Quizora DCA Quiz Platform — Production Smoke Test Suite

Use this comprehensive manual verification checklist to perform a pre-flight smoke test before hosting a live examination.

---

## 📋 1. Admin Workflow Verification

- [ ] **Admin Authentication**: Log in as `ADMIN` role. Verify redirect to Admin Navigation.
- [ ] **Manual User Creation**: Navigate to `/admin/users/new`, create a test student profile (`name: Test Student`, `username: student_smoke`, `course: DCA`). Verify profile appears in User Directory.
- [ ] **Excel Bulk Import**: Navigate to `/admin/users/import`, upload a sample `.xlsx` spreadsheet. Verify Phase 1 preview validation detects duplicate usernames/roll numbers, and Phase 2 bulk execution creates active accounts.
- [ ] **Paper Builder & Custom Marks**: Navigate to `/admin/papers/new`, create a paper with `requiredQuestionCount: 50`, select 50 MCQ questions, set `total_marks: 100` (2.00 marks/question). Save draft.
- [ ] **Paper Publishing**: On `/admin/papers`, click **Publish Quiz**. Confirm modal. Verify generated access code badge pill (e.g. `DCA-7K4P9X`) is displayed and copied to clipboard.

---

## 📋 2. Student Examination Workflow Verification

- [ ] **Student Authentication**: Log in as `STUDENT` role (`student_smoke`). Verify redirect to Student Dashboard (`/student`).
- [ ] **Access Code Entry**: Click **Enter Access Code**, paste `DCA-7K4P9X`. Verify redirect to Pre-Exam Instructions page (`/student/exam/start/[paperId]`).
- [ ] **Fullscreen Request**: Click **Start Exam Now**. Verify browser triggers fullscreen mode request. Verify exam runner does not launch if fullscreen is denied.
- [ ] **Exam Interface & Question Navigation**: Verify 50 questions rendered with question matrix, marks indicator, and timer countdown.
- [ ] **Immediate Per-Option Persistence**: Click option **B** on Question 1. Verify sync status immediately changes to `Saved ✓` (`POST /api/exam/answers`).
- [ ] **Refresh & State Recovery**: Reload browser (`F5`). Verify saved answers, current question index, and remaining timer are recovered identically without creating a duplicate attempt.

---

## 📋 3. Integrity Monitoring & Proctor Control Verification

- [ ] **Fullscreen Exit Overlay**: Press `ESC` to exit fullscreen. Verify dark obscuring overlay covers the exam with message `"Fullscreen mode is required to take this examination"`. Click **Return to Fullscreen** to restore view.
- [ ] **Tab Switch Warning**: Switch to another browser tab and return. Verify non-destructive warning toast appears: `"Exam integrity warning: 1 integrity event detected"`.
- [ ] **3-Violation Lockout**: Switch tabs 2 more times (total 3 violations). Verify attempt is locked (`status = 'LOCKED'`) and lock screen overlay is displayed (`"Your examination has been temporarily locked. Please contact the exam proctor."`). Verify option selection buttons are disabled and answer modification returns HTTP 423.
- [ ] **Proctor Dashboard (`/proctor`)**: Log in as `PROCTOR` role in another browser. Verify locked student appears in table with red `LOCKED` badge and violation count = 3.
- [ ] **Proctor Reopen & Same-Question Resume**: Click **Timeline** → **Reopen Exam**. Confirm modal. Verify student screen automatically detects `IN_PROGRESS` transition, unfreezes overlay, and resumes at the exact question index with all saved answers intact!

---

## 📋 4. Server-Side Grading & Leaderboard Verification

- [ ] **Exam Submission**: Complete exam and click final submit. Verify redirect to Student Results page (`/student/results/[attemptId]`).
- [ ] **Score & Percentage Accuracy**: Verify server calculated score, percentage, correct answer breakdown, and explanation list accurately.
- [ ] **Admin Leaderboard (`/admin/papers/[paperId]/results`)**: Open Admin Leaderboard. Verify deterministic ranking:
  1. Score `DESC`
  2. Submitted At `ASC` (earlier submission ranks higher on equal score)
  3. Attempt ID `ASC`
- [ ] **Tie-Breaker Explanations**: Verify tie-breaker explanation badge is displayed for students with equal scores.
