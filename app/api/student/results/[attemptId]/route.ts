import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { attemptId } = params;
    const supabase = createAdminClient();

    const { data: attempt, error } = await supabase
      .from('exam_attempts')
      .select('*, papers(title, course, total_marks, show_result_to_student), profiles(name, course, username)')
      .eq('id', attemptId)
      .single();

    if (error || !attempt) {
      return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });
    }

    // Authorization: Must be owner student or ADMIN
    if (attempt.user_id !== auth.profile.id && auth.profile.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized result access' },
        { status: 403 }
      );
    }

    // SERVER-SIDE RESULT VISIBILITY ENFORCEMENT FOR STUDENTS
    if (auth.profile.role === 'STUDENT' && attempt.papers && attempt.papers.show_result_to_student === false) {
      return NextResponse.json(
        {
          success: true,
          resultHidden: true,
          data: {
            attemptId: attempt.id,
            paperTitle: attempt.papers?.title || 'DCA Exam',
            studentName: attempt.profiles?.name || auth.profile.name,
            course: attempt.profiles?.course || auth.profile.course,
            username: attempt.profiles?.username || auth.profile.username,
            status: attempt.status,
            submittedAt: attempt.submitted_at,
            resultHidden: true,
            message: 'Exam submitted successfully. Score & result details will be published by your administrator.',
          },
        },
        { status: 200 }
      );
    }

    const { count: totalQuestions } = await supabase
      .from('paper_questions')
      .select('*', { count: 'exact', head: true })
      .eq('paper_id', attempt.paper_id);

    const { count: attemptedCount } = await supabase
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_id', attemptId);

    const score = Number(attempt.score || 0);
    const totalMarks = attempt.total_marks || attempt.papers?.total_marks || 50;
    const percentage = Number(((score / totalMarks) * 100).toFixed(2));

    const startedTime = attempt.started_at ? new Date(attempt.started_at).getTime() : 0;
    const submittedTime = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : 0;
    const completionTimeSeconds =
      startedTime && submittedTime ? Math.max(0, Math.floor((submittedTime - startedTime) / 1000)) : 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          attemptId: attempt.id,
          paperTitle: attempt.papers?.title || 'DCA Exam',
          studentName: attempt.profiles?.name || auth.profile.name,
          course: attempt.profiles?.course || auth.profile.course,
          username: attempt.profiles?.username || auth.profile.username,
          score,
          totalMarks,
          percentage,
          totalQuestions: totalQuestions || 50,
          attemptedQuestions: attemptedCount || 0,
          status: attempt.status,
          submittedAt: attempt.submitted_at,
          startedAt: attempt.started_at,
          completionTimeSeconds,
        },
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
