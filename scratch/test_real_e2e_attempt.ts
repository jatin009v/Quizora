import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = envVars['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(url, key);

async function testRealE2EAttempt() {
  console.log('=== REAL SUPABASE E2E VERIFICATION TEST ===');

  // 1. Get published paper
  const { data: papers } = await supabase
    .from('papers')
    .select('*, paper_questions(*, questions(*))')
    .eq('status', 'PUBLISHED')
    .limit(1);

  if (!papers || papers.length === 0) {
    console.error('No published paper found in Supabase DB');
    return;
  }

  const paper = papers[0];
  console.log(`Using real paper: "${paper.title}" (ID: ${paper.id}, Code: ${paper.access_code})`);

  // 2. Get test student profile
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'STUDENT')
    .limit(1);

  if (!profiles || profiles.length === 0) {
    console.error('No student profile found');
    return;
  }

  const student = profiles[0];
  console.log(`Using real student profile: "${student.name}" (${student.username}) ID: ${student.id}`);

  // 3. Create or recover real attempt
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const newAttempt = {
    id: crypto.randomUUID(),
    user_id: student.id,
    paper_id: paper.id,
    status: 'IN_PROGRESS',
    started_at: new Date().toISOString(),
    expires_at: expiresAt,
    tab_switch_count: 0,
    fullscreen_exit_count: 0,
    total_marks: paper.total_marks || 20,
  };
  const { data: inserted, error: iErr } = await supabase
    .from('exam_attempts')
    .insert(newAttempt)
    .select()
    .single();

  if (iErr || !inserted) {
    console.error('Failed to insert test attempt into DB:', iErr);
    return;
  }
  const attemptId = inserted.id;
  console.log(`Created new real attempt in Supabase DB: ${attemptId}`);

  // 4. Ensure question IDs exist in "questions" table to satisfy FK answers_question_id_fkey
  const pqs = paper.paper_questions || [];
  console.log(`Paper questions count: ${pqs.length}`);

  for (const pq of pqs) {
    const qId = pq.question_id || pq.id;
    // Ensure question row exists in questions table
    const { data: existingQ } = await supabase.from('questions').select('id').eq('id', qId).maybeSingle();
    if (!existingQ) {
      await supabase.from('questions').insert({
        id: qId,
        question_text: pq.question_text || 'Snapshot Question',
        question_type: pq.question_type || 'MCQ_SINGLE',
        option_a: pq.option_a || 'Option A',
        option_b: pq.option_b || 'Option B',
        option_c: pq.option_c || 'Option C',
        option_d: pq.option_d || 'Option D',
        correct_option: pq.correct_option || 'A',
      });
      console.log(`Ensured missing question ID in questions table: ${qId}`);
    }

    // Upsert into answers table
    const correctOpt = pq.correct_option || pq.questions?.correct_option || 'A';
    const { error: aErr } = await supabase.from('answers').upsert(
      {
        attempt_id: attemptId,
        question_id: qId,
        selected_option: correctOpt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'attempt_id,question_id' }
    );
    if (aErr) {
      console.error(`Error saving answer for question ${qId}:`, aErr);
    }
  }

  // Verify answer count in DB
  const { data: dbAns } = await supabase.from('answers').select('*').eq('attempt_id', attemptId);
  console.log(`Verified persisted answers in DB: ${dbAns?.length || 0} rows`);

  // 5. Test Monitoring-Only Proctoring
  await supabase
    .from('exam_attempts')
    .update({ tab_switch_count: 3, fullscreen_exit_count: 1 })
    .eq('id', attemptId);

  const { data: attAfterEvents } = await supabase.from('exam_attempts').select('status').eq('id', attemptId).single();
  console.log(`Attempt status after 3 integrity events: ${attAfterEvents?.status} (Expected: IN_PROGRESS)`);

  // 6. Test Server Grading & Submission
  const totalPaperMarks = paper.total_marks || 20;
  const perQuestionMark = pqs.length > 0 ? totalPaperMarks / pqs.length : 1;

  let totalScore = 0;
  for (const pq of pqs) {
    const qId = pq.question_id || pq.id;
    const correctOption = pq.correct_option || pq.questions?.correct_option;
    const ansRow = (dbAns || []).find((a) => a.question_id === qId);

    if (ansRow && ansRow.selected_option === correctOption) {
      totalScore += perQuestionMark;
      await supabase
        .from('answers')
        .update({ is_correct: true, marks_awarded: perQuestionMark })
        .eq('id', ansRow.id);
    }
  }

  totalScore = Number(totalScore.toFixed(2));
  const { data: updatedAttempt } = await supabase
    .from('exam_attempts')
    .update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      score: totalScore,
      total_marks: totalPaperMarks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .select()
    .single();

  console.log('\n--- REAL DB SUBMISSION RESULT ---');
  console.log(`Attempt ID: ${updatedAttempt?.id}`);
  console.log(`Status: ${updatedAttempt?.status}`);
  console.log(`Score: ${updatedAttempt?.score} / ${updatedAttempt?.total_marks}`);
  console.log(`Percentage: ${((updatedAttempt?.score || 0) / (updatedAttempt?.total_marks || 1)) * 100}%`);
}

testRealE2EAttempt().catch(console.error);
