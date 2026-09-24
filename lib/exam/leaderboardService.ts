import { createAdminClient } from '@/lib/supabase/admin';
import { mockExamStore } from './service';
import { submitExamAttempt } from './submissionService';

export interface LeaderboardEntry {
  rank: number;
  attemptId: string;
  userId: string;
  studentName: string;
  course: string;
  username: string;
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
  startedAt: string | null;
  completionTimeSeconds: number;
  tieReason?: string;
}

export interface PaperLeaderboardResult {
  success: boolean;
  error?: string;
  paperTitle?: string;
  totalParticipants: number;
  submittedCount: number;
  inProgressCount: number;
  lockedCount: number;
  highestScore: number;
  averageScore: number;
  leaderboard: LeaderboardEntry[];
}

export async function getPaperLeaderboard(paperId: string): Promise<PaperLeaderboardResult> {
  const supabase = createAdminClient();

  try {
    let rawAttempts: any[] = [];
    let paperTitle = 'DCA Examination Paper';

    if (process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      rawAttempts = Array.from(mockExamStore.attempts.values()).filter(
        (att) => att.paper_id === paperId
      );
    } else {
      const { data: paperData } = await supabase
        .from('papers')
        .select('title')
        .eq('id', paperId)
        .single();
      if (paperData) paperTitle = paperData.title;

      const { data: attData } = await supabase
        .from('exam_attempts')
        .select('*, profiles(name, course, username)')
        .eq('paper_id', paperId);

      if (attData) rawAttempts = attData;
    }

    // Auto-finalize any expired attempts that are still IN_PROGRESS or LOCKED
    for (const att of rawAttempts) {
      if (
        att.status !== 'SUBMITTED' &&
        att.expires_at &&
        new Date(att.expires_at).getTime() <= Date.now()
      ) {
        const subRes = await submitExamAttempt(att.user_id, att.id);
        if (subRes.success && subRes.data) {
          att.status = 'SUBMITTED';
          att.score = subRes.data.score;
          att.total_marks = subRes.data.totalMarks;
          att.submitted_at = subRes.data.submittedAt;
        }
      }
    }

    const totalParticipants = rawAttempts.length;
    const submittedAttempts = rawAttempts.filter((a) => a.status === 'SUBMITTED');
    const inProgressCount = rawAttempts.filter((a) => a.status === 'IN_PROGRESS').length;
    const lockedCount = rawAttempts.filter((a) => a.status === 'LOCKED').length;

    // DETERMINISTIC SORTING:
    // PRIMARY: score DESC
    // SECONDARY: submitted_at ASC (Earlier submission timestamp wins tie)
    // TERTIARY: id ASC (Deterministic tie-breaking if timestamps match)
    submittedAttempts.sort((a, b) => {
      const scoreA = Number(a.score || 0);
      const scoreB = Number(b.score || 0);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }

      const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
      const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;

      if (timeA !== timeB) {
        return timeA - timeB; // Earlier submission first
      }

      return a.id.localeCompare(b.id);
    });

    const scores = submittedAttempts.map((a) => Number(a.score || 0));
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const averageScore =
      scores.length > 0
        ? Number((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2))
        : 0;

    // Generate rank entries and detect tie reasons
    const leaderboard: LeaderboardEntry[] = submittedAttempts.map((att, idx) => {
      const studentName = att.profiles?.name || att.user_id || `Student-${idx + 1}`;
      const course = att.profiles?.course || 'DCA';
      const username = att.profiles?.username || `student${idx + 1}`;
      const score = Number(att.score || 0);
      const totalMarks = att.total_marks || 50;
      const percentage = Number(((score / totalMarks) * 100).toFixed(2));

      const startedTime = att.started_at ? new Date(att.started_at).getTime() : 0;
      const submittedTime = att.submitted_at ? new Date(att.submitted_at).getTime() : 0;
      const completionTimeSeconds =
        startedTime && submittedTime ? Math.max(0, Math.floor((submittedTime - startedTime) / 1000)) : 0;

      let tieReason: string | undefined = undefined;

      // Check if previous or next entry tied on score
      const prev = idx > 0 ? submittedAttempts[idx - 1] : null;
      const next = idx < submittedAttempts.length - 1 ? submittedAttempts[idx + 1] : null;

      if (prev && Number(prev.score || 0) === score) {
        const prevTime = prev.submitted_at
          ? new Date(prev.submitted_at).toLocaleTimeString()
          : 'N/A';
        const currTime = att.submitted_at
          ? new Date(att.submitted_at).toLocaleTimeString()
          : 'N/A';
        tieReason = `Tie on score (${score} pts) — Rank #${idx} submitted earlier (${prevTime} vs ${currTime})`;
      } else if (next && Number(next.score || 0) === score) {
        const currTime = att.submitted_at
          ? new Date(att.submitted_at).toLocaleTimeString()
          : 'N/A';
        const nextTime = next.submitted_at
          ? new Date(next.submitted_at).toLocaleTimeString()
          : 'N/A';
        tieReason = `Tie on score (${score} pts) — Rank #${idx + 1} submitted earlier (${currTime} vs ${nextTime})`;
      }

      return {
        rank: idx + 1,
        attemptId: att.id,
        userId: att.user_id,
        studentName,
        course,
        username,
        score,
        totalMarks,
        percentage,
        submittedAt: att.submitted_at || new Date().toISOString(),
        startedAt: att.started_at,
        completionTimeSeconds,
        tieReason,
      };
    });

    return {
      success: true,
      paperTitle,
      totalParticipants,
      submittedCount: submittedAttempts.length,
      inProgressCount,
      lockedCount,
      highestScore,
      averageScore,
      leaderboard,
    };
  } catch (err) {
    console.error('Leaderboard calculation error:', err);
    return {
      success: false,
      error: 'Failed to generate leaderboard',
      totalParticipants: 0,
      submittedCount: 0,
      inProgressCount: 0,
      lockedCount: 0,
      highestScore: 0,
      averageScore: 0,
      leaderboard: [],
    };
  }
}
