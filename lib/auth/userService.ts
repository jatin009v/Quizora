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

export async function listUsersForAdmin(filters?: {
  course?: string;
  status?: string;
  query?: string;
}): Promise<{ success: boolean; users: Profile[] }> {
  const supabase = createAdminClient();

  try {
    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      let users = Array.from(mockUserProfiles.values());
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
      return { success: true, users };
    }

    let dbQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (filters?.course && filters.course !== 'ALL') {
      dbQuery = dbQuery.eq('course', filters.course);
    }
    if (filters?.status && filters.status !== 'ALL') {
      dbQuery = dbQuery.eq('status', filters.status);
    }
    if (filters?.query) {
      dbQuery = dbQuery.or(`name.ilike.%${filters.query}%,username.ilike.%${filters.query}%`);
    }

    const { data: users } = await dbQuery;

    return { success: true, users: (users as Profile[]) || [] };
  } catch {
    return { success: false, users: [] };
  }
}
