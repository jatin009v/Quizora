import { createAdminClient } from '@/lib/supabase/admin';
import { CreateUserInput, UpdateUserStatusInput } from '@/lib/validation/auth';
import { Profile } from '@/types/database';
import { mapUsernameToInternalEmail } from './session';
import { mockExamStore } from '../exam/service';

export interface CreateUserResult {
  success: boolean;
  error?: string;
  code?: string;
  data?: {
    userId: string;
    username: string;
    name: string;
    role: string;
  };
}

// In-Memory Mock Profile Store for Vitest / Unseeded execution
export const mockUserProfiles = new Map<string, Profile>();
export const mockAuditLogs = new Array<any>();

export async function createSingleUser(
  adminProfileId: string,
  input: CreateUserInput
): Promise<CreateUserResult> {
  const { name, course, year = '1st Year', username, password, role = 'STUDENT' } = input;
  const sanitizedUsername = username.toLowerCase().trim();
  const internalEmail = mapUsernameToInternalEmail(sanitizedUsername);
  const nowIso = new Date().toISOString();

  const supabase = createAdminClient();

  try {
    // 1. Check existing username uniqueness
    let existingUsername = false;

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      existingUsername = Array.from(mockUserProfiles.values()).some(
        (p) => p.username.toLowerCase() === sanitizedUsername
      );
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', sanitizedUsername)
        .maybeSingle();
      existingUsername = !!data;
    }

    if (existingUsername) {
      return {
        success: false,
        error: `Username "${sanitizedUsername}" already exists.`,
        code: 'DUPLICATE_USERNAME',
      };
    }

    // Isolated test / fallback mode
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const profileId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const authUserId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const profile: Profile = {
        id: profileId,
        auth_user_id: authUserId,
        name,
        course,
        year,
        username: sanitizedUsername,
        role,
        status: 'ACTIVE',
        created_at: nowIso,
        updated_at: nowIso,
      };

      mockUserProfiles.set(profileId, profile);

      // Audit Log RECORD (WITHOUT PASSWORD!)
      mockAuditLogs.push({
        id: `audit-${Date.now()}`,
        admin_user_id: adminProfileId,
        action: 'USER_CREATED',
        target_type: 'PROFILE',
        target_id: profileId,
        metadata: { name, username: sanitizedUsername, course, year, role },
        created_at: nowIso,
      });

      return {
        success: true,
        data: {
          userId: profileId,
          username: sanitizedUsername,
          name,
          role,
        },
      };
    }

    // 2. Create Supabase Auth User via Service Role Client
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true,
      user_metadata: { name, username: sanitizedUsername, role },
    });

    if (authError || !authUser.user) {
      console.error('Supabase Auth createUser error:', authError);
      return {
        success: false,
        error: authError?.message || 'Failed to create identity account',
        code: 'AUTH_CREATION_FAILED',
      };
    }

    // 3. Create Profiles Table Record
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        auth_user_id: authUser.user.id,
        name,
        course,
        year,
        username: sanitizedUsername,
        role,
        status: 'ACTIVE',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (profileError || !profileData) {
      console.error('Profile insert error:', profileError);
      // Rollback Auth user creation if profile fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return { success: false, error: 'Failed to create profile record', code: 'PROFILE_FAILED' };
    }

    // 4. Audit Log (PASSWORD OMITTED)
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminProfileId,
      action: 'USER_CREATED',
      target_type: 'PROFILE',
      target_id: profileData.id,
      metadata: { name, username: sanitizedUsername, course, year, role },
      created_at: nowIso,
    });

    return {
      success: true,
      data: {
        userId: profileData.id,
        username: sanitizedUsername,
        name,
        role,
      },
    };
  } catch (err: any) {
    console.error('Unexpected error in createSingleUser:', err);
    return { success: false, error: 'Internal server error', code: 'SERVER_ERROR' };
  }
}

export async function updateUserStatus(
  adminProfileId: string,
  input: UpdateUserStatusInput
): Promise<{ success: boolean; error?: string }> {
  const { userId, status } = input;
  const nowIso = new Date().toISOString();
  const supabase = createAdminClient();

  try {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const p = mockUserProfiles.get(userId);
      if (p) {
        p.status = status;
        p.updated_at = nowIso;
        mockUserProfiles.set(userId, p);

        mockAuditLogs.push({
          id: `audit-${Date.now()}`,
          admin_user_id: adminProfileId,
          action: status === 'DISABLED' ? 'USER_DISABLED' : 'USER_ENABLED',
          target_type: 'PROFILE',
          target_id: userId,
          metadata: { status },
          created_at: nowIso,
        });
        return { success: true };
      }
      return { success: false, error: 'User not found' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ status, updated_at: nowIso })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminProfileId,
      action: status === 'DISABLED' ? 'USER_DISABLED' : 'USER_ENABLED',
      target_type: 'PROFILE',
      target_id: userId,
      metadata: { status },
      created_at: nowIso,
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Server error' };
  }
}

export const PROTECTED_DEMO_USERNAME = 'csjma22000022674';

export function isUserProtected(profile: { role: string; username: string }): boolean {
  if (profile.role === 'ADMIN' || profile.role === 'PROCTOR') return true;
  if (profile.username.toLowerCase() === PROTECTED_DEMO_USERNAME.toLowerCase()) return true;
  return false;
}

export async function deleteSingleParticipant(
  adminProfileId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch profile to check protection rules
    let profileToUpdate: Profile | null = null;

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      profileToUpdate = mockUserProfiles.get(targetUserId) || null;
      if (!profileToUpdate) {
        profileToUpdate = Array.from(mockUserProfiles.values()).find(
          (p) => p.id === targetUserId || p.auth_user_id === targetUserId
        ) || null;
      }
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${targetUserId},auth_user_id.eq.${targetUserId}`)
        .maybeSingle();
      profileToUpdate = data as Profile | null;
    }

    if (!profileToUpdate) {
      return { success: false, error: 'Target participant account not found.' };
    }

    // 2. Enforce Protection Rules
    if (isUserProtected(profileToUpdate)) {
      return {
        success: false,
        error: 'Protected account (ADMIN, PROCTOR, or permanent Demo User) cannot be deleted.',
      };
    }

    if (profileToUpdate.role !== 'STUDENT') {
      return { success: false, error: 'Only student participant accounts can be deleted.' };
    }

    // 3. Perform Cascading Deletion
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const attemptIds = Array.from(mockExamStore.attempts.values())
        .filter((a) => a.user_id === profileToUpdate!.id)
        .map((a) => a.id);

      attemptIds.forEach((attId) => {
        mockExamStore.attempts.delete(attId);
        mockExamStore.answers.delete(attId);
      });

      mockUserProfiles.delete(profileToUpdate.id);

      mockAuditLogs.push({
        id: `audit-${Date.now()}`,
        admin_user_id: adminProfileId,
        action: 'PARTICIPANT_DELETED',
        target_type: 'PROFILE',
        target_id: profileToUpdate.id,
        metadata: { username: profileToUpdate.username, name: profileToUpdate.name },
        created_at: nowIso,
      });

      return { success: true };
    }

    // Live Database Deletion
    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('user_id', profileToUpdate.id);

    const attemptIds = (attempts || []).map((a) => a.id);

    if (attemptIds.length > 0) {
      await supabase.from('answers').delete().in('attempt_id', attemptIds);
      await supabase.from('proctor_events').delete().in('attempt_id', attemptIds);
      await supabase.from('exam_attempts').delete().eq('user_id', profileToUpdate.id);
    }

    const { error: profileDelErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileToUpdate.id);

    if (profileDelErr) {
      return { success: false, error: `Failed to delete profile: ${profileDelErr.message}` };
    }

    if (profileToUpdate.auth_user_id) {
      try {
        await supabase.auth.admin.deleteUser(profileToUpdate.auth_user_id);
      } catch (authErr: any) {
        console.warn('Warning deleting auth user:', authErr.message);
      }
    }

    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminProfileId,
      action: 'PARTICIPANT_DELETED',
      target_type: 'PROFILE',
      target_id: profileToUpdate.id,
      metadata: { username: profileToUpdate.username, name: profileToUpdate.name },
      created_at: nowIso,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error deleting participant:', err);
    return { success: false, error: err.message || 'Failed to delete participant' };
  }
}

export async function deleteAllParticipants(
  adminProfileId: string
): Promise<{ success: boolean; deletedCount: number; failedCount: number; error?: string }> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const allProfiles = Array.from(mockUserProfiles.values());
      const targetProfiles = allProfiles.filter((p) => !isUserProtected(p) && p.role === 'STUDENT');

      let deletedCount = 0;
      targetProfiles.forEach((p) => {
        const attemptIds = Array.from(mockExamStore.attempts.values())
          .filter((a) => a.user_id === p.id)
          .map((a) => a.id);

        attemptIds.forEach((attId) => {
          mockExamStore.attempts.delete(attId);
          mockExamStore.answers.delete(attId);
        });

        mockUserProfiles.delete(p.id);
        deletedCount++;
      });

      mockAuditLogs.push({
        id: `audit-${Date.now()}`,
        admin_user_id: adminProfileId,
        action: 'PARTICIPANTS_BULK_DELETED',
        target_type: 'PROFILE',
        metadata: { deletedCount },
        created_at: nowIso,
      });

      return { success: true, deletedCount, failedCount: 0 };
    }

    const { data: profiles, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, auth_user_id, username, role')
      .eq('role', 'STUDENT')
      .neq('username', PROTECTED_DEMO_USERNAME);

    if (fetchErr) {
      return { success: false, deletedCount: 0, failedCount: 0, error: fetchErr.message };
    }

    const targetProfiles = (profiles || []).filter((p) => !isUserProtected(p));

    if (targetProfiles.length === 0) {
      return { success: true, deletedCount: 0, failedCount: 0 };
    }

    const targetUserIds = targetProfiles.map((p) => p.id);

    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('id')
      .in('user_id', targetUserIds);

    const attemptIds = (attempts || []).map((a) => a.id);

    if (attemptIds.length > 0) {
      await supabase.from('answers').delete().in('attempt_id', attemptIds);
      await supabase.from('proctor_events').delete().in('attempt_id', attemptIds);
      await supabase.from('exam_attempts').delete().in('user_id', targetUserIds);
    }

    const { error: deleteProfErr } = await supabase
      .from('profiles')
      .delete()
      .in('id', targetUserIds);

    if (deleteProfErr) {
      return { success: false, deletedCount: 0, failedCount: targetUserIds.length, error: deleteProfErr.message };
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const p of targetProfiles) {
      if (p.auth_user_id) {
        try {
          await supabase.auth.admin.deleteUser(p.auth_user_id);
          deletedCount++;
        } catch {
          failedCount++;
        }
      } else {
        deletedCount++;
      }
    }

    await supabase.from('admin_audit_logs').insert({
      admin_user_id: adminProfileId,
      action: 'PARTICIPANTS_BULK_DELETED',
      target_type: 'PROFILE',
      metadata: { deletedCount, failedCount },
      created_at: nowIso,
    });

    return { success: true, deletedCount, failedCount };
  } catch (err: any) {
    console.error('Error in bulk participant deletion:', err);
    return { success: false, deletedCount: 0, failedCount: 0, error: err.message || 'Server error' };
  }
}

export async function listUsersForAdmin(filters?: {
  course?: string;
  status?: string;
  query?: string;
  tab?: 'ADMIN_PROCTOR' | 'PARTICIPANTS';
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; users: Profile[]; total: number; page: number; totalPages: number }> {
  const page = filters?.page || 1;
  const limit = filters?.limit || 25;
  const offset = (page - 1) * limit;
  const tab = filters?.tab || 'PARTICIPANTS';

  const supabase = createAdminClient();

  try {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      let users = Array.from(mockUserProfiles.values());

      if (tab === 'ADMIN_PROCTOR') {
        users = users.filter((u) => u.role === 'ADMIN' || u.role === 'PROCTOR' || u.username.toLowerCase() === PROTECTED_DEMO_USERNAME.toLowerCase());
      } else {
        users = users.filter((u) => u.role === 'STUDENT' && u.username.toLowerCase() !== PROTECTED_DEMO_USERNAME.toLowerCase());
      }

      if (filters?.course && filters.course !== 'ALL') {
        users = users.filter((u) => u.course === filters.course);
      }
      if (filters?.status && filters.status !== 'ALL') {
        users = users.filter((u) => u.status === filters.status);
      }
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        users = users.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
      }

      const total = users.length;
      const paginatedUsers = users.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit) || 1;

      return { success: true, users: paginatedUsers, total, page, totalPages };
    }

    let dbQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    if (tab === 'ADMIN_PROCTOR') {
      dbQuery = dbQuery.or(`role.eq.ADMIN,role.eq.PROCTOR,username.eq.${PROTECTED_DEMO_USERNAME}`);
    } else {
      dbQuery = dbQuery.eq('role', 'STUDENT').neq('username', PROTECTED_DEMO_USERNAME);
    }

    if (filters?.course && filters.course !== 'ALL') {
      dbQuery = dbQuery.eq('course', filters.course);
    }
    if (filters?.status && filters.status !== 'ALL') {
      dbQuery = dbQuery.eq('status', filters.status);
    }
    if (filters?.query) {
      dbQuery = dbQuery.or(`name.ilike.%${filters.query}%,username.ilike.%${filters.query}%`);
    }

    dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: users, count } = await dbQuery;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      success: true,
      users: (users as Profile[]) || [],
      total,
      page,
      totalPages,
    };
  } catch {
    return { success: false, users: [], total: 0, page: 1, totalPages: 1 };
  }
}
