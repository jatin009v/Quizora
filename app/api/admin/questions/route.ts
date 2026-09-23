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
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      let questions = Array.from(mockExamStore.questions.values());
      if (difficulty && difficulty !== 'ALL') {
        questions = questions.filter((q) => q.difficulty === difficulty);
      }
      if (query) {
        const qStr = query.toLowerCase();
        questions = questions.filter((q) => q.question_text.toLowerCase().includes(qStr));
      }
      const total = questions.length;
      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || '1', 10));
        const limit = Math.max(1, parseInt(limitParam || '10', 10));
        const start = (page - 1) * limit;
        const pagedQs = questions.slice(start, start + limit);
        return NextResponse.json({
          success: true,
          questions: pagedQs,
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1,
        }, { status: 200 });
      }
      return NextResponse.json({ success: true, questions, total, page: 1, totalPages: 1 }, { status: 200 });
    }

    const supabase = createAdminClient();

    let dbQuery = supabase
      .from('questions')
      .select('id, question_text, question_type, difficulty, option_a, option_b, option_c, option_d, marks, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (difficulty && difficulty !== 'ALL') {
      dbQuery = dbQuery.eq('difficulty', difficulty);
    }

    if (questionType && questionType !== 'ALL') {
      dbQuery = dbQuery.eq('question_type', questionType);
    }

    if (query) {
      dbQuery = dbQuery.ilike('question_text', `%${query}%`);
    }

    // Apply pagination if requested or by default for performance
    const isPaginated = pageParam !== null || (limitParam !== null && limitParam !== 'all');
    const page = Math.max(1, parseInt(pageParam || '1', 10));
    const limit = limitParam === 'all' ? 1000 : Math.max(1, parseInt(limitParam || '10', 10));

    if (isPaginated && limitParam !== 'all') {
      const from = (page - 1) * limit;
      const to = page * limit - 1;
      dbQuery = dbQuery.range(from, to);
    }

    const { data: questions, count, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const total = count ?? (questions?.length || 0);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

    return NextResponse.json({
      success: true,
      questions: questions || [],
      total,
      page,
      totalPages,
    }, { status: 200 });
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

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get('id');

    if (!questionId) {
      return NextResponse.json({ success: false, error: 'Question ID required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check if question is referenced by any paper
    const { count: usageCount } = await supabase
      .from('paper_questions')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', questionId);

    if (usageCount && usageCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete question: it is currently referenced by active examination paper(s).' },
        { status: 400 }
      );
    }

    const { error: delError } = await supabase.from('questions').delete().eq('id', questionId);

    if (delError) {
      return NextResponse.json({ success: false, error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Question deleted from bank successfully.' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
