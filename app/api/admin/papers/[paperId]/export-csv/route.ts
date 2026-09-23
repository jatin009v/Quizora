import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { mockExamStore } from '@/lib/exam/service';

export const dynamic = 'force-dynamic';

function escapeCsvCell(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return '""';
  const str = String(cell);
  return `"${str.replace(/"/g, '""')}"`;
}

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
    let paperTitle = 'Examination Paper';
    let paperCourse = 'DCA';
    let defaultTotalMarks = 50;
    let rawAttempts: any[] = [];

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      const paper = mockExamStore.papers.get(paperId);
      if (paper) {
        paperTitle = paper.title;
        paperCourse = paper.course || 'DCA';
        defaultTotalMarks = paper.total_marks || 50;
      }
      rawAttempts = Array.from(mockExamStore.attempts.values()).filter(
        (a) => a.paper_id === paperId
      );
    } else {
      const supabase = createAdminClient();

      const { data: paperData, error: paperErr } = await supabase
        .from('papers')
        .select('title, course, total_marks')
        .eq('id', paperId)
        .maybeSingle();

      if (paperErr || !paperData) {
        return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
      }

      paperTitle = paperData.title;
      paperCourse = paperData.course || 'DCA';
      defaultTotalMarks = paperData.total_marks || 50;

      const { data: attData } = await supabase
        .from('exam_attempts')
        .select('id, user_id, score, total_marks, status, submitted_at, created_at, profiles(name, username, course)')
        .eq('paper_id', paperId)
        .order('score', { ascending: false });

      if (attData) rawAttempts = attData;
    }

    // Build CSV Content
    const headers = [
      'Student Name',
      'Username',
      'Course',
      'Paper Title',
      'Score',
      'Total Marks',
      'Percentage',
      'Submission Time',
      'Attempt Status',
    ];

    const rows: string[] = [];
    rows.push(headers.map((h) => escapeCsvCell(h)).join(','));

    for (const att of rawAttempts) {
      const studentName = att.profiles?.name || att.user_id || 'Unknown';
      const username = att.profiles?.username || 'unknown';
      const course = att.profiles?.course || paperCourse;
      const score = Number(att.score || 0);
      const totalMarks = Number(att.total_marks || defaultTotalMarks);
      const percentage = totalMarks > 0 ? ((score / totalMarks) * 100).toFixed(2) + '%' : '0.00%';
      const subTime = att.submitted_at ? new Date(att.submitted_at).toISOString() : (att.created_at || '');
      const status = att.status || 'SUBMITTED';

      const row = [
        escapeCsvCell(studentName),
        escapeCsvCell(username),
        escapeCsvCell(course),
        escapeCsvCell(paperTitle),
        escapeCsvCell(score),
        escapeCsvCell(totalMarks),
        escapeCsvCell(percentage),
        escapeCsvCell(subTime),
        escapeCsvCell(status),
      ];
      rows.push(row.join(','));
    }

    const csvContent = rows.join('\r\n');
    const slug = paperTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'paper';
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `quizora-results-${slug}-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
