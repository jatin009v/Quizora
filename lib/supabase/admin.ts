import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-only Admin Supabase Client using Service Role Key
// WARNING: NEVER import or expose this file in client-side components!
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://quizora-dca-demo.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not defined. Falling back to anon key for development/demo.');
  }

  const keyToUse =
    serviceRoleKey ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'demo-anon-key';

  return createSupabaseClient(supabaseUrl, keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
