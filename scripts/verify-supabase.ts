import { createAdminClient } from '../lib/supabase/admin';

async function checkRemoteDatabase() {
  const supabase = createAdminClient();
  const tables = [
    'profiles',
    'questions',
    'papers',
    'paper_questions',
    'exam_attempts',
    'answers',
    'proctor_events',
    'admin_audit_logs',
  ];

  console.log('=====================================================');
  console.log('🔍 SUPABASE REMOTE DATABASE AUDIT');
  console.log('=====================================================');

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        console.log(`❌ Table [${table}]: ERROR -> ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`✅ Table [${table}]: EXISTS -> ${data?.length ?? 0} rows found`);
        if (data && data.length > 0) {
          console.log(`   Sample record:`, JSON.stringify(data[0]).substring(0, 120) + '...');
        }
      }
    } catch (err: any) {
      console.log(`❌ Table [${table}]: EXCEPTION -> ${err.message}`);
    }
  }
}

checkRemoteDatabase();
