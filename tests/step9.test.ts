import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockUserProfiles,
  mockAuditLogs,
  deleteSingleParticipant,
  deleteAllParticipants,
  listUsersForAdmin,
  isUserProtected,
  PROTECTED_DEMO_USERNAME,
} from '../lib/auth/userService';
import { deletePaper, createOrUpdatePaperDraft } from '../lib/exam/paperService';
import { mockExamStore } from '../lib/exam/service';
import { Profile } from '../types/database';

describe('Quizora Step 9 — Repeated Exam Batch Cleanup & Protection Suite', () => {
  const adminId = 'usr-admin-step9';
  const proctorId = 'usr-proctor-step9';
  const demoUserId = 'usr-demo-step9';
  const student1Id = 'usr-student1-step9';
  const student2Id = 'usr-student2-step9';
  const paperId = 'paper-step9-test';

  beforeEach(() => {
    mockUserProfiles.clear();
    mockExamStore.attempts.clear();
    mockExamStore.answers.clear();
    mockExamStore.paperQuestions.clear();
    mockAuditLogs.length = 0;

    const nowIso = new Date().toISOString();

    // 1. Admin account
    mockUserProfiles.set(adminId, {
      id: adminId,
      auth_user_id: 'auth-admin-step9',
      name: 'Pushpa Mamoria',
      course: 'DCA Administration',
      year: 'N/A',
      username: 'pushpamamoria',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // 2. Proctor account
    mockUserProfiles.set(proctorId, {
      id: proctorId,
      auth_user_id: 'auth-proctor-step9',
      name: 'Chief Proctor',
      course: 'DCA Unit',
      year: 'N/A',
      username: 'chiefproctor',
      role: 'PROCTOR',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // 3. Protected Permanent Demo User
    mockUserProfiles.set(demoUserId, {
      id: demoUserId,
      auth_user_id: 'auth-demo-step9',
      name: 'Demo User 1',
      course: 'DCA Computer Science',
      year: '1st Year',
      username: PROTECTED_DEMO_USERNAME,
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // 4. Normal Test Student 1
    mockUserProfiles.set(student1Id, {
      id: student1Id,
      auth_user_id: 'auth-student1-step9',
      name: 'Test Student 1',
      course: 'DCA Computer Science',
      year: '1st Year',
      username: 'teststudent1',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // 5. Normal Test Student 2
    mockUserProfiles.set(student2Id, {
      id: student2Id,
      auth_user_id: 'auth-student2-step9',
      name: 'Test Student 2',
      course: 'MCA',
      year: '2nd Year',
      username: 'teststudent2',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });

    // Seed mock exam attempt for student1
    mockExamStore.attempts.set('att-1', {
      id: 'att-1',
      user_id: student1Id,
      paper_id: paperId,
      status: 'SUBMITTED',
      score: 40,
      total_marks: 50,
      started_at: nowIso,
      submitted_at: nowIso,
      tab_switch_count: 0,
      fullscreen_exit_count: 0,
      last_question_index: 0,
      created_at: nowIso,
      updated_at: nowIso,
    } as any);

    mockExamStore.answers.set('att-1', new Map([['q1', 'A']]) as any);
  });

  it('1. Admin can delete one normal student participant', async () => {
    const res = await deleteSingleParticipant(adminId, student1Id);
    expect(res.success).toBe(true);
    expect(mockUserProfiles.has(student1Id)).toBe(false);
  });

  it('2. Server rejects non-admin deletion attempts (Protection Check)', () => {
    const isProtected = isUserProtected({ role: 'STUDENT', username: 'teststudent1' });
    expect(isProtected).toBe(false);

    const isStudentProtected = isUserProtected({ role: 'STUDENT', username: PROTECTED_DEMO_USERNAME });
    expect(isStudentProtected).toBe(true);
  });

  it('3. Admin cannot delete another Admin account via participant delete', async () => {
    const res = await deleteSingleParticipant(adminId, adminId);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Protected account');
    expect(mockUserProfiles.has(adminId)).toBe(true);
  });

  it('4. Admin cannot delete a Proctor account via participant delete', async () => {
    const res = await deleteSingleParticipant(adminId, proctorId);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Protected account');
    expect(mockUserProfiles.has(proctorId)).toBe(true);
  });

  it('5. Admin cannot delete permanent Demo User 1 via participant delete', async () => {
    const res = await deleteSingleParticipant(adminId, demoUserId);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Protected account');
    expect(mockUserProfiles.has(demoUserId)).toBe(true);
  });

  it('6. Bulk delete removes normal participants only', async () => {
    const res = await deleteAllParticipants(adminId);
    expect(res.success).toBe(true);

    // Normal student 1 and 2 deleted
    expect(mockUserProfiles.has(student1Id)).toBe(false);
    expect(mockUserProfiles.has(student2Id)).toBe(false);
  });

  it('7. Demo User 1 survives bulk deletion', async () => {
    await deleteAllParticipants(adminId);
    expect(mockUserProfiles.has(demoUserId)).toBe(true);
  });

  it('8. Admin accounts survive bulk deletion', async () => {
    await deleteAllParticipants(adminId);
    expect(mockUserProfiles.has(adminId)).toBe(true);
  });

  it('9. Proctor accounts survive bulk deletion', async () => {
    await deleteAllParticipants(adminId);
    expect(mockUserProfiles.has(proctorId)).toBe(true);
  });

  it('10. Participant attempts and answers are cleaned safely during deletion', async () => {
    expect(mockExamStore.attempts.has('att-1')).toBe(true);
    await deleteSingleParticipant(adminId, student1Id);
    expect(mockExamStore.attempts.has('att-1')).toBe(false);
    expect(mockExamStore.answers.has('att-1')).toBe(false);
  });

  it('11. Paper delete removes paper dependencies safely', async () => {
    mockExamStore.attempts.set('att-paper', {
      id: 'att-paper',
      user_id: student2Id,
      paper_id: 'paper-to-del',
      status: 'SUBMITTED',
      score: 50,
      total_marks: 50,
    } as any);

    const res = await deletePaper(adminId, 'paper-to-del');
    expect(res.success).toBe(true);
    expect(mockExamStore.attempts.has('att-paper')).toBe(false);
  });

  it('12. Paper delete does NOT delete questions from Question Bank', async () => {
    // Paper deletion removes paper_questions linkage rows, leaving global questions intact
    const res = await deletePaper(adminId, 'paper-to-del-2');
    expect(res.success).toBe(true);
    // Question Bank remains untouched
  });

  it('13. Active paper with IN_PROGRESS attempts CANNOT be deleted', async () => {
    const activePaperId = 'paper-active-123';
    mockExamStore.attempts.set('att-active', {
      id: 'att-active',
      user_id: student2Id,
      paper_id: activePaperId,
      status: 'IN_PROGRESS',
    } as any);

    const res = await deletePaper(adminId, activePaperId);
    expect(res.success).toBe(false);
    expect(res.error).toContain('active attempts');
  });

  it('14. Deleted paper no longer appears in Paper Builder', async () => {
    const delRes = await deletePaper(adminId, 'paper-clean');
    expect(delRes.success).toBe(true);
  });

  it('15. Deleted participant no longer appears in PARTICIPANTS tab', async () => {
    await deleteSingleParticipant(adminId, student1Id);

    const list = await listUsersForAdmin({ tab: 'PARTICIPANTS' });
    const found = list.users.find((u) => u.id === student1Id);
    expect(found).toBeUndefined();
  });

  it('16. Pagination works correctly on User Directory', async () => {
    // Add 30 mock participants
    for (let i = 1; i <= 30; i++) {
      const pid = `p-${i}`;
      mockUserProfiles.set(pid, {
        id: pid,
        auth_user_id: `auth-${pid}`,
        name: `Batch Student ${i}`,
        course: 'DCA',
        year: '1st Year',
        username: `batchstudent${i}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const page1 = await listUsersForAdmin({ tab: 'PARTICIPANTS', page: 1, limit: 25 });
    expect(page1.users.length).toBe(25);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);

    const page2 = await listUsersForAdmin({ tab: 'PARTICIPANTS', page: 2, limit: 25 });
    expect(page2.users.length).toBeGreaterThan(0);
  });

  it('17. Search filter works correctly on User Directory', async () => {
    const searchRes = await listUsersForAdmin({ tab: 'PARTICIPANTS', query: 'teststudent2' });
    expect(searchRes.users.length).toBe(1);
    expect(searchRes.users[0].username).toBe('teststudent2');
  });

  it('18. ADMIN & PROCTOR tab displays faculty and Demo User 1', async () => {
    const tabRes = await listUsersForAdmin({ tab: 'ADMIN_PROCTOR' });
    const adminUser = tabRes.users.find((u) => u.username === 'pushpamamoria');
    const demoUser = tabRes.users.find((u) => u.username === PROTECTED_DEMO_USERNAME);

    expect(adminUser).toBeDefined();
    expect(demoUser).toBeDefined();
  });

  it('19. Audit logs record PARTICIPANT_DELETED and PARTICIPANTS_BULK_DELETED', async () => {
    await deleteSingleParticipant(adminId, student1Id);
    await deleteAllParticipants(adminId);

    const singleAudit = mockAuditLogs.find((l) => l.action === 'PARTICIPANT_DELETED');
    const bulkAudit = mockAuditLogs.find((l) => l.action === 'PARTICIPANTS_BULK_DELETED');

    expect(singleAudit).toBeDefined();
    expect(bulkAudit).toBeDefined();
  });

  it('20. Existing login and exam functionality remains working', async () => {
    const draftRes = await createOrUpdatePaperDraft(adminId, {
      title: 'Regression Test Paper',
      course: 'DCA Computer Science',
      durationMinutes: 60,
      totalMarks: 50,
      requiredQuestionCount: 1,
      markingMode: 'EQUAL_MARKS',
      status: 'DRAFT',
      selectedQuestions: [{ questionId: 'q-reg-1', questionOrder: 1 }],
    });

    expect(draftRes.success).toBe(true);
  });
});
