import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { mockExamStore } from '@/lib/exam/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const difficulty = searchParams.get('difficulty');
    const questionType = searchParams.get('type');
    const query = searchParams.get('query');

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      let questions = Array.from(mockExamStore.questions.values());
      if (difficulty && difficulty !== 'ALL') {
        questions = questions.filter((q) => q.difficulty === difficulty);
      }
      if (query) {
        const qStr = query.toLowerCase();
        questions = questions.filter((q) => q.question_text.toLowerCase().includes(qStr));
      }
      return NextResponse.json({ success: true, questions }, { status: 200 });
    }

    const supabase = createAdminClient();

    let dbQuery = supabase.from('questions').select('*').order('created_at', { ascending: false });

    if (difficulty && difficulty !== 'ALL') {
      dbQuery = dbQuery.eq('difficulty', difficulty);
    }

    if (questionType && questionType !== 'ALL') {
      dbQuery = dbQuery.eq('question_type', questionType);
    }

    if (query) {
      dbQuery = dbQuery.ilike('question_text', `%${query}%`);
    }

    const { data: questions, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, questions: questions || [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      question_text,
      question_type = 'MCQ_SINGLE',
      difficulty = 'MEDIUM',
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      code_snippet,
      marks = 1,
    } = body;

    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return NextResponse.json(
        { success: false, error: 'Question text, all 4 options, and correct option are required.' },
        { status: 400 }
      );
    }

    const validOptions = ['A', 'B', 'C', 'D'];
    const normalizedCorrect = String(correct_option).toUpperCase().trim();
    if (!validOptions.includes(normalizedCorrect)) {
      return NextResponse.json(
        { success: false, error: 'Correct option must be A, B, C, or D.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const id = `q-${Date.now()}`;
      const newQ = {
        id,
        question_text,
        question_type,
        difficulty,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option: normalizedCorrect,
        explanation: explanation || null,
        code_snippet: code_snippet || null,
        marks: Number(marks) || 1,
        created_at: nowIso,
        updated_at: nowIso,
      };
      mockExamStore.questions.set(id, newQ);
      return NextResponse.json({ success: true, question: newQ }, { status: 201 });
    }

    const supabase = createAdminClient();
    const { data: newQ, error } = await supabase
      .from('questions')
      .insert({
        question_text,
        question_type,
        difficulty,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option: normalizedCorrect,
        explanation: explanation || null,
        code_snippet: code_snippet || null,
        marks: Number(marks) || 1,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, question: newQ }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
