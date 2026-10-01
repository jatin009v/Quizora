import { createAdminClient } from '../lib/supabase/admin';
import { mapUsernameToInternalEmail } from '../lib/auth/session';

async function bootstrapAccount(
  username: string,
  pass: string,
  name: string,
  course: string,
  year: string,
  role: 'ADMIN' | 'PROCTOR' | 'STUDENT'
) {
  const supabase = createAdminClient();
  const internalEmail = mapUsernameToInternalEmail(username);
  const nowIso = new Date().toISOString();

  console.log(`[BOOTSTRAP] Processing account for user: ${username} (${role})...`);

  // 1. Check if profile already exists in public.profiles
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  let authUserId = existingProfile?.auth_user_id;

  if (!authUserId) {
    // 2. Create Auth user via Supabase Service Role Admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password: pass,
      email_confirm: true,
      user_metadata: { name, username, role },
    });

    if (authError) {
      // If user already exists in auth.users, fetch auth ID
      const { data: listData } = await supabase.auth.admin.listUsers();
      const match = listData?.users.find((u) => u.email === internalEmail);
      if (match) {
        authUserId = match.id;
        await supabase.auth.admin.updateUserById(match.id, { password: pass });
        console.log(`[BOOTSTRAP] Updated password for existing auth user: ${username}`);
      } else {
        console.error(`[BOOTSTRAP ERROR] Failed to create auth user ${username}:`, authError.message);
        return;
      }
    } else if (authUser.user) {
      authUserId = authUser.user.id;
      console.log(`[BOOTSTRAP] Created Supabase Auth user identity: ${username}`);
    }
  }

  // 3. Insert or Update Profile Record
  if (existingProfile) {
    await supabase
      .from('profiles')
      .update({
        auth_user_id: authUserId,
        name,
        course,
        year,
        role,
        status: 'ACTIVE',
        updated_at: nowIso,
      })
      .eq('id', existingProfile.id);
    console.log(`[BOOTSTRAP SUCCESS] Linked profile for ${username}`);
  } else {
    await supabase.from('profiles').insert({
      auth_user_id: authUserId,
      name,
      course,
      year,
      username,
      role,
      status: 'ACTIVE',
      created_at: nowIso,
      updated_at: nowIso,
    });
    console.log(`[BOOTSTRAP SUCCESS] Created profile record for ${username}`);
  }
}

async function runBootstrap() {
  console.log('=====================================================');
  console.log('🚀 QUIZORA DCA PLATFORM BOOTSTRAPPER');
  console.log('=====================================================');

  try {
    // 1. Bootstrap System Administrator
    await bootstrapAccount('admin', process.env.ADMIN_PASSWORD || 'admin123', 'System Administrator', 'DCA Administration', '1st Year', 'ADMIN');
    if (process.env.SANKALP_PASSWORD) {
      await bootstrapAccount('sankalp', process.env.SANKALP_PASSWORD, 'Sankalp', 'DCA Administration', '1st Year', 'ADMIN');
    }

    // 2. Bootstrap Chief Exam Proctor
    await bootstrapAccount('proctor', 'proctor123', 'Chief Exam Proctor', 'DCA Examination Unit', '1st Year', 'PROCTOR');

    // 3. Bootstrap Test Candidate Students
    await bootstrapAccount('student1', 'student123', 'Alex Chen', 'DCA Computer Science', '1st Year', 'STUDENT');
    await bootstrapAccount('student2', 'student123', 'Jordan Smith', 'DCA Computer Science', '2nd Year', 'STUDENT');

    console.log('=====================================================');
    console.log('✅ BOOTSTRAP COMPLETE');
    console.log('Accounts ready:');
    console.log('  • Admin:   username=admin');
    console.log('  • Proctor: username=proctor');
    console.log('  • Student: username=student1');
    console.log('=====================================================');
  } catch (err) {
    console.error('Fatal bootstrap error:', err);
  }
}

runBootstrap();
