import { createAdminClient } from '../lib/supabase/admin';

async function seedRemoteSupabase() {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  console.log('=====================================================');
  console.log('🌱 SEEDING REMOTE SUPABASE WITH EXAM QUESTIONS & PAPER');
  console.log('=====================================================');

  // 1. Get Admin Profile ID
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', 'admin')
    .single();

  const adminId = adminProfile?.id;

  // 2. Insert Question Bank
  const questionsData = [
    {
      id: '10000000-0000-0000-0000-000000000001',
      question_text: 'What does CPU stand for in Computer Science?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      option_a: 'Central Processing Unit',
      option_b: 'Computer Performance Utility',
      option_c: 'Central Power Unit',
      option_d: 'Control Program Unit',
      correct_option: 'A',
      explanation: 'CPU stands for Central Processing Unit.',
      marks: 2,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      question_text: 'Which memory type is volatile and loses contents when power is turned off?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      option_a: 'ROM',
      option_b: 'RAM',
      option_c: 'EEPROM',
      option_d: 'Hard Disk',
      correct_option: 'B',
      explanation: 'RAM (Random Access Memory) is main memory and is volatile.',
      marks: 2,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: '10000000-0000-0000-0000-000000000003',
      question_text: 'What is the standard port number for HTTPS secure web traffic?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      option_a: '80',
      option_b: '21',
      option_c: '443',
      option_d: '8080',
      correct_option: 'C',
      explanation: 'HTTPS operates on port 443.',
      marks: 2,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: '10000000-0000-0000-0000-000000000004',
      question_text: 'Which OSI layer is responsible for IP routing and packet delivery across networks?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      option_a: 'Data Link Layer',
      option_b: 'Network Layer',
      option_c: 'Transport Layer',
      option_d: 'Session Layer',
      correct_option: 'B',
      explanation: 'Network Layer (Layer 3) handles IP routing.',
      marks: 2,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: '10000000-0000-0000-0000-000000000005',
      question_text: 'What is the binary representation of the decimal number 255?',
      question_type: 'MCQ_SINGLE',
      difficulty: 'HARD',
      option_a: '11111110',
      option_b: '10000000',
      option_c: '11111111',
      option_d: '11100000',
      correct_option: 'C',
      explanation: '255 in binary is 11111111.',
      marks: 2,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  for (const q of questionsData) {
    await supabase.from('questions').upsert(q, { onConflict: 'id' });
  }
  console.log('✅ Question Bank seeded (5 MCQs)');

  // 3. Insert Exam Paper
  const paperData = {
    id: '20000000-0000-0000-0000-000000000001',
    title: 'DCA Computer Science Certification Exam 2026',
    description: 'Official DCA Comprehensive Computer Science & Networking Examination.',
    course: 'DCA Computer Science',
    duration_minutes: 60,
    total_marks: 10,
    status: 'PUBLISHED',
    access_code: 'DCA2026',
    created_by: adminId,
    start_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    end_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    published_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await supabase.from('papers').upsert(paperData, { onConflict: 'id' });
  console.log('✅ Exam Paper seeded (DCA2026)');

  // 4. Insert Paper Questions Mapping
  const paperQuestionsData = questionsData.map((q, idx) => ({
    paper_id: '20000000-0000-0000-0000-000000000001',
    question_id: q.id,
    question_order: idx + 1,
    marks: 2,
    created_at: nowIso,
  }));

  for (const pq of paperQuestionsData) {
    await supabase.from('paper_questions').upsert(pq, { onConflict: 'paper_id,question_id' });
  }
  console.log('✅ Paper Questions mapped');

  console.log('=====================================================');
  console.log('🎉 REMOTE SUPABASE SEED COMPLETE');
  console.log('=====================================================');
}

seedRemoteSupabase();
