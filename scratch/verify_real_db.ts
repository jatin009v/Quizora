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

console.log('Connecting to Supabase:', url);
const supabase = createClient(url, key);

async function run() {
  // 1. Check papers
  const { data: papers, error: pErr } = await supabase.from('papers').select('*');
  console.log('\n========================================');
  console.log('1. PAPERS IN REAL SUPABASE DB (Count:', papers?.length || 0, ')');
  console.log('========================================');
  if (pErr) console.error('Paper error:', pErr);
  if (papers) {
    papers.forEach((p) =>
      console.log(`- ID: ${p.id} | Code: "${p.access_code}" | Status: ${p.status} | Title: "${p.title}"`)
    );
  }

  // 2. Check exam attempts
  const { data: attempts, error: aErr } = await supabase
    .from('exam_attempts')
    .select('*, profiles(name, username, course), papers(title)');

  console.log('\n========================================');
  console.log('2. EXAM ATTEMPTS IN REAL SUPABASE DB (Count:', attempts?.length || 0, ')');
  console.log('========================================');
  if (aErr) console.error('Attempt error:', aErr);
  if (attempts) {
    const byStatus = attempts.reduce((acc: any, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Attempts by Status:', JSON.stringify(byStatus, null, 2));

    console.log('\nSample Exam Attempts from Today\'s Lab Test:');
    attempts.forEach((a) => {
      console.log(
        `- Attempt ID: ${a.id} | Student: ${a.profiles?.name} (${a.profiles?.username}) | Status: ${a.status} | Score: ${a.score}/${a.total_marks} | Tab Switches: ${a.tab_switch_count}`
      );
    });
  }

  // 3. Check answers table
  const { data: allAnswers, error: ansErr } = await supabase.from('answers').select('*');
  console.log('\n========================================');
  console.log('3. ANSWERS TABLE IN REAL SUPABASE DB (Count:', allAnswers?.length || 0, ')');
  console.log('========================================');
  if (ansErr) console.error('Answers error:', ansErr);
  if (allAnswers && allAnswers.length > 0) {
    const answersByAttempt = allAnswers.reduce((acc: any, ans) => {
      acc[ans.attempt_id] = (acc[ans.attempt_id] || 0) + 1;
      return acc;
    }, {});
    console.log('Answer count per attempt_id in DB:', JSON.stringify(answersByAttempt, null, 2));
    console.log('Sample answer rows in DB:', allAnswers.slice(0, 10));
  } else {
    console.log('CRITICAL DATABASE EVIDENCE: 0 rows found in the "answers" table in the real Supabase database!');
  }

  // 4. Trace ONE specific attempt completely
  if (attempts && attempts.length > 0) {
    const sampleAtt = attempts[0];
    console.log('\n========================================');
    console.log('4. DEEP TRACE OF ONE REAL DB ATTEMPT:', sampleAtt.id);
    console.log('========================================');
    console.log('Attempt Status:', sampleAtt.status);
    console.log('User ID:', sampleAtt.user_id);
    console.log('Paper ID:', sampleAtt.paper_id);
    console.log('Score:', sampleAtt.score);
    console.log('Total Marks:', sampleAtt.total_marks);
    console.log('Started At:', sampleAtt.started_at);
    console.log('Submitted At:', sampleAtt.submitted_at);

    // Answers for this attempt
    const { data: attAns } = await supabase.from('answers').select('*').eq('attempt_id', sampleAtt.id);
    console.log(`Persisted answers for attempt ${sampleAtt.id}:`, attAns?.length || 0, 'rows');
    if (attAns) console.log('Answers list:', attAns);

    // Paper questions snapshot
    const { data: pqList } = await supabase
      .from('paper_questions')
      .select('*, questions(*)')
      .eq('paper_id', sampleAtt.paper_id);

    console.log(`Paper questions snapshot for paper ${sampleAtt.paper_id}:`, pqList?.length || 0, 'questions');
    if (pqList) {
      pqList.forEach((pq: any) => {
        console.log(`- PQ ID: ${pq.id} | Question ID: ${pq.question_id} | Correct Option: ${pq.correct_option || pq.questions?.correct_option}`);
      });
    }
  }

  // 5. Access Codes Audit
  if (papers) {
    console.log('\n========================================');
    console.log('5. ACCESS CODE AUDIT ACROSS ALL PAPERS');
    console.log('========================================');
    const codeMap = new Map<string, any[]>();
    papers.forEach((p) => {
      if (p.access_code) {
        const norm = p.access_code.trim().toUpperCase();
        const list = codeMap.get(norm) || [];
        list.push(p);
        codeMap.set(norm, list);
      }
    });

    for (const [code, list] of codeMap.entries()) {
      if (list.length > 1) {
        console.log(`DUPLICATE ACCESS CODE DETECTED: "${code}" is used by ${list.length} papers:`);
        list.forEach((p) => console.log(`   -> Paper ID: ${p.id}, Title: "${p.title}", Status: ${p.status}, Published: ${p.published_at}`));
      } else {
        console.log(`UNIQUE ACCESS CODE: "${code}" -> Paper ID: ${list[0].id} (${list[0].status})`);
      }
    }
  }

  // 6. Proctor events audit
  const { data: procEvents } = await supabase.from('proctor_events').select('*');
  console.log('\n========================================');
  console.log('6. PROCTOR EVENTS IN REAL SUPABASE DB (Count:', procEvents?.length || 0, ')');
  console.log('========================================');
  if (procEvents) {
    const eventsByAttempt = procEvents.reduce((acc: any, ev) => {
      acc[ev.attempt_id] = (acc[ev.attempt_id] || 0) + 1;
      return acc;
    }, {});
    console.log('Proctor events count per attempt:', JSON.stringify(eventsByAttempt, null, 2));
  }
}

run().catch(console.error);
