import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { CreatePaperSchema } from '@/lib/validation/paper';
import { createOrUpdatePaperDraft } from '@/lib/exam/paperService';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { paperId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const { paperId } = params;
    const supabase = createAdminClient();

    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('*')
      .eq('id', paperId)
      .single();

    if (paperError || !paper) {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }

    const { data: paperQuestions } = await supabase
      .from('paper_questions')
      .select('question_id, question_order, marks, questions(*)')
      .eq('paper_id', paperId)
      .order('question_order', { ascending: true });

    return NextResponse.json(
      {
        success: true,
        paper,
        paperQuestions: paperQuestions || [],
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { paperId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = CreatePaperSchema.safeParse({ ...body, id: params.paperId });

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'Invalid paper data' },
        { status: 400 }
      );
    }

    const result = await createOrUpdatePaperDraft(auth.profile.id, validation.data);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, paperId: result.paperId, data: result.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
