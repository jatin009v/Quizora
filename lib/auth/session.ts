import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Profile, UserRole } from '@/types/database';

export interface AuthContext {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile;
}

export function mapUsernameToInternalEmail(username: string): string {
  const sanitized = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  return `${sanitized}@auth.quizora.internal`;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    // Fetch matching profile
    const adminSupabase = createAdminClient();
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      // Default demo profile for unseeded dev environments
      return {
        user: { id: user.id, email: user.email },
        profile: {
          id: user.id,
          auth_user_id: user.id,
          name: user.email?.split('@')[0] || 'User',
          course: 'DCA Computer Science',
          roll_number: '2026-DCA-001',
          username: user.email?.split('@')[0] || 'student',
          role: 'STUDENT',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    }

    // Block disabled users from accessing active context
    if (profile.status === 'DISABLED') {
      return null;
    }

    return {
      user: { id: user.id, email: user.email },
      profile: profile as Profile,
    };
  } catch (err) {
    console.error('Failed to resolve auth context:', err);
    return null;
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error('UNAUTHORIZED');
  }
  return ctx;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!allowedRoles.includes(ctx.profile.role)) {
    throw new Error('FORBIDDEN_ROLE');
  }
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  return requireRole(['ADMIN']);
}

export async function requireStudent(): Promise<AuthContext> {
  return requireRole(['STUDENT']);
}

export async function requireProctor(): Promise<AuthContext> {
  return requireRole(['PROCTOR', 'ADMIN']);
}
