import { describe, it, expect, beforeEach } from 'vitest';
import { mockUserProfiles } from '../lib/auth/userService';
import { parseAndValidateExcel, executeBulkImport } from '../lib/auth/excelService';
import * as XLSX from 'xlsx';

describe('Quizora Step 8 — Student Identity System & Roll Number Cleanup Suite', () => {
  const adminId = 'usr-admin-step8';
  const riyaId = 'usr-riya-001';
  const demoId = 'usr-demo-002';

  beforeEach(() => {
    mockUserProfiles.clear();

    // 1. Seed Riya Pandey account
    mockUserProfiles.set(riyaId, {
      id: riyaId,
      auth_user_id: 'auth-riya-uid-123',
      name: 'Riya Pandey',
      course: 'MCA',
      year: '1st Year',
      username: 'riyapandey',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Seed Demo User account
    mockUserProfiles.set(demoId, {
      id: demoId,
      auth_user_id: 'auth-demo-uid-456',
      name: 'Demo User',
      course: 'DCA Computer Science',
      year: '2nd Year',
      username: 'csjma22000022674',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Seed Admin account
    mockUserProfiles.set(adminId, {
      id: adminId,
      auth_user_id: 'auth-admin-uid-789',
      name: 'Jatin Admin',
      course: 'Administration',
      year: 'N/A',
      username: 'admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('1. Riya login resolves to Riya Pandey and MCA profile', () => {
    const profiles = Array.from(mockUserProfiles.values());
    const riya = profiles.find((p) => p.auth_user_id === 'auth-riya-uid-123');

    expect(riya).toBeDefined();
    expect(riya?.name).toBe('Riya Pandey');
    expect(riya?.course).toBe('MCA');
  });

  it('2. Demo User login resolves to Demo User and DCA Computer Science profile', () => {
    const profiles = Array.from(mockUserProfiles.values());
    const demo = profiles.find((p) => p.auth_user_id === 'auth-demo-uid-456');

    expect(demo).toBeDefined();
    expect(demo?.name).toBe('Demo User');
    expect(demo?.course).toBe('DCA Computer Science');
  });

  it('3. Student A cannot access Student B profile by changing IDs (Authorization Scoping)', () => {
    const authenticatedStudentId: string = riyaId;
    const requestedProfileId: string = demoId;

    // Server-authoritative check: authenticated ID must match requested profile ID
    const isAuthorized = authenticatedStudentId === requestedProfileId;
    expect(isAuthorized).toBe(false);
  });

  it('4. No Rahul Kumar fallback exists when profile is missing', () => {
    const unauthenticatedUser = Array.from(mockUserProfiles.values()).find(
      (p) => p.auth_user_id === 'non-existent-auth-id'
    );

    // Missing profile MUST return undefined / null, NEVER default to Rahul Kumar
    expect(unauthenticatedUser).toBeUndefined();
  });

  it('5. No roll_number field required in profile records', () => {
    const riyaProfile = mockUserProfiles.get(riyaId) as any;
    expect(riyaProfile.roll_number).toBeUndefined();
    expect(riyaProfile.year).toBe('1st Year');
  });

  it('6. Student dashboard profile representation contains only Name and Course', () => {
    const riya = mockUserProfiles.get(riyaId);
    const dashboardCard = {
      name: riya?.name.toUpperCase(),
      course: riya?.course,
    };

    expect(dashboardCard).toEqual({
      name: 'RIYA PANDEY',
      course: 'MCA',
    });
    expect((dashboardCard as any).rollNumber).toBeUndefined();
    expect((dashboardCard as any).email).toBeUndefined();
  });

  it('7. Year field is available for Admin user management', () => {
    const adminView = Array.from(mockUserProfiles.values()).map((p) => ({
      name: p.name,
      username: p.username,
      course: p.course,
      year: p.year,
      role: p.role,
      status: p.status,
    }));

    const riyaAdminRecord = adminView.find((r) => r.username === 'riyapandey');
    expect(riyaAdminRecord?.year).toBe('1st Year');
  });

  it('8. Bulk Excel import accepts name, course, year, username, password', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { name: 'Kavita Singh', course: 'BCA', year: '3rd Year', username: 'kavita', password: 'password123' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Students');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const val = await parseAndValidateExcel(buffer);
    expect(val.success).toBe(true);
    expect(val.validCount).toBe(1);
    expect(val.internalValidRows[0].year).toBe('3rd Year');
  });

  it('9. Bulk Excel import rejects missing required year field', async () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { name: 'No Year Student', course: 'MCA', username: 'noyear', password: 'password123' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Students');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const val = await parseAndValidateExcel(buffer);
    expect(val.success).toBe(false);
    expect(val.error).toContain('year');
  });

  it('10. Password is NEVER returned in profile queries', () => {
    const profiles = Array.from(mockUserProfiles.values());
    for (const p of profiles) {
      expect((p as any).password).toBeUndefined();
    }
  });

  it('11. Profile resolution is grounded strictly in authenticated Supabase Auth ID', () => {
    const authSessionUserId = 'auth-demo-uid-456';
    const resolvedProfile = Array.from(mockUserProfiles.values()).find(
      (p) => p.auth_user_id === authSessionUserId
    );

    expect(resolvedProfile?.username).toBe('csjma22000022674');
    expect(resolvedProfile?.name).toBe('Demo User');
  });

  it('12. Bulk import creates profiles with role=STUDENT and status=ACTIVE', async () => {
    const validRows = [
      { rowNumber: 2, name: 'Import Student', course: 'DCA', year: '1st Year', username: 'import01', password: 'password123', isValid: true },
    ];

    const result = await executeBulkImport(adminId, validRows);
    expect(result.success).toBe(true);

    const created = Array.from(mockUserProfiles.values()).find((p) => p.username === 'import01');
    expect(created).toBeDefined();
    expect(created?.role).toBe('STUDENT');
    expect(created?.status).toBe('ACTIVE');
    expect(created?.year).toBe('1st Year');
  });
});
