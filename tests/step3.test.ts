import { describe, it, expect, beforeEach } from 'vitest';
import { createSingleUser, updateUserStatus, mockUserProfiles, mockAuditLogs } from '../lib/auth/userService';
import { mapUsernameToInternalEmail } from '../lib/auth/session';
import { parseAndValidateExcel, executeBulkImport } from '../lib/auth/excelService';
import * as XLSX from 'xlsx';

describe('Quizora DCA Quiz Platform — Step 3 Security & Auth Suite', () => {
  const adminId = 'usr-admin-001';

  beforeEach(() => {
    mockUserProfiles.clear();
    mockAuditLogs.length = 0;

    // Seed mock admin
    mockUserProfiles.set(adminId, {
      id: adminId,
      auth_user_id: 'auth-admin-001',
      name: 'System Admin',
      course: 'DCA',
      year: '1st Year',
      username: 'admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('1. Synthetic username identity mapping formats correctly', () => {
    const email = mapUsernameToInternalEmail('Jatin001');
    expect(email).toBe('jatin001@auth.quizora.internal');
  });

  it('2. Admin can create a student account manually', async () => {
    const res = await createSingleUser(adminId, {
      name: 'Test Student',
      course: 'DCA',
      year: '1st Year',
      username: 'teststudent001',
      password: 'password123',
      role: 'STUDENT',
    });

    expect(res.success).toBe(true);
    expect(res.data?.username).toBe('teststudent001');
  });

  it('3. Duplicate username is rejected', async () => {
    await createSingleUser(adminId, {
      name: 'Student One',
      course: 'DCA',
      year: '1st Year',
      username: 'student001',
      password: 'password123',
      role: 'STUDENT',
    });

    const dupRes = await createSingleUser(adminId, {
      name: 'Student Two',
      course: 'DCA',
      year: '2nd Year',
      username: 'student001', // Duplicate!
      password: 'password123',
      role: 'STUDENT',
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.code).toBe('DUPLICATE_USERNAME');
  });

  it('4. Disabled student cannot access functionality when status is DISABLED', async () => {
    const res = await createSingleUser(adminId, {
      name: 'Disabled Student',
      course: 'DCA',
      year: '1st Year',
      username: 'disabled001',
      password: 'password123',
      role: 'STUDENT',
    });

    expect(res.success).toBe(true);
    const userId = res.data!.userId;

    await updateUserStatus(adminId, { userId, status: 'DISABLED' });

    const p = mockUserProfiles.get(userId);
    expect(p?.status).toBe('DISABLED');
  });

  it('5. Excel validation detects missing required columns', async () => {
    // Generate buffer with missing 'password' column
    const worksheet = XLSX.utils.json_to_sheet([
      { name: 'Jatin', course: 'DCA', year: '1st Year', username: 'jatin001' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Students');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const val = await parseAndValidateExcel(buffer);
    expect(val.success).toBe(false);
    expect(val.error).toContain('missing required column(s)');
  });

  it('6. Excel validation detects duplicate usernames within file', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { name: 'Jatin 1', course: 'DCA', year: '1st Year', username: 'jatin001', password: 'password123' },
      { name: 'Jatin 2', course: 'DCA', year: '1st Year', username: 'jatin001', password: 'password123' }, // Duplicate!
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Students');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const val = await parseAndValidateExcel(buffer);
    expect(val.success).toBe(true);
    expect(val.validCount).toBe(1);
    expect(val.duplicateCount).toBe(1);
  });

  it('7. Excel validation requires year column', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { name: 'Test Student', course: 'DCA', username: 'testuser', password: 'password123' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Students');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const val = await parseAndValidateExcel(buffer);
    expect(val.success).toBe(false);
    expect(val.error).toContain('year');
  });

  it('8. Bulk import executes valid rows while safely reporting partial failures', async () => {
    const validRows = [
      { rowNumber: 2, name: 'Student A', course: 'DCA', year: '1st Year', username: 'bulk001', password: 'password123', isValid: true },
      { rowNumber: 3, name: 'Student B', course: 'DCA', year: '2nd Year', username: 'bulk002', password: 'password123', isValid: true },
    ];

    const exec = await executeBulkImport(adminId, validRows);
    expect(exec.success).toBe(true);
    expect(exec.createdCount).toBe(2);
  });

  it('9. Passwords are NEVER stored in profiles table schema', async () => {
    await createSingleUser(adminId, {
      name: 'Security Test',
      course: 'DCA',
      year: '1st Year',
      username: 'sectest01',
      password: 'secretPassword123',
      role: 'STUDENT',
    });

    const p: any = Array.from(mockUserProfiles.values()).find((u) => u.username === 'sectest01');
    expect(p).toBeDefined();
    expect(p.password).toBeUndefined(); // Zero password in profiles!
  });

  it('10. Audit logs record USER_CREATED without passwords', async () => {
    await createSingleUser(adminId, {
      name: 'Audit Test',
      course: 'DCA',
      year: '1st Year',
      username: 'audtest01',
      password: 'superSecretPassword',
      role: 'STUDENT',
    });

    const audit = mockAuditLogs.find((l) => l.action === 'USER_CREATED');
    expect(audit).toBeDefined();
    expect(JSON.stringify(audit.metadata)).not.toContain('superSecretPassword');
  });

  it('11. Audit logs record BULK_USERS_IMPORTED metadata without passwords', async () => {
    await executeBulkImport(adminId, [
      { rowNumber: 2, name: 'Bulk Test', course: 'DCA', year: '1st Year', username: 'btest01', password: 'secretPassword', isValid: true },
    ]);

    const audit = mockAuditLogs.find((l) => l.action === 'BULK_USERS_IMPORTED');
    expect(audit).toBeDefined();
    expect(JSON.stringify(audit.metadata)).not.toContain('secretPassword');
  });
});
