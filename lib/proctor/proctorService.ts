import { createAdminClient } from '@/lib/supabase/admin';
import { ProctorEventType, AttemptStatus, ExamAttempt } from '@/types/database';
import { ProctorEventInput, ProctorAttemptFilter } from '@/lib/validation/proctor';
import { mockExamStore } from '@/lib/exam/service';
import { mockUserProfiles } from '@/lib/auth/userService';

// Cooldown window in milliseconds for browser integrity event deduplication
const EVENT_DEDUPLICATION_COOLDOWN_MS = 2000;

// Events that qualify as integrity violation signals
const QUALIFYING_VIOLATION_EVENTS: ProctorEventType[] = [
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
];

// In-Memory store for proctor events during test / unseeded execution
export const mockProctorEvents = new Array<any>();

export interface LogEventResult {
  success: boolean;
  attemptId: string;
  eventType: ProctorEventType;
  tabSwitchCount: number;
  isLocked: boolean;
  status: AttemptStatus;
  warningMessage?: string;
}

const isTestOrLocal = () =>
  process.env.NODE_ENV === 'test' || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co');

/**
 * Log a proctor integrity event for a student attempt.
 * Evaluates 2-second cooldown deduplication and enforces the 3-violation lockout policy.
 */
export async function logProctorEvent(
  input: ProctorEventInput,
  studentProfileId: string
): Promise<LogEventResult> {
  const adminClient = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  let attempt: ExamAttempt | null = null;

  if (isTestOrLocal()) {
    attempt = mockExamStore.attempts.get(input.attemptId) || null;
  } else {
    const { data, error } = await adminClient
      .from('exam_attempts')
      .select('id, user_id, paper_id, status, tab_switch_count, fullscreen_exit_count, last_question_index, expires_at')
      .eq('id', input.attemptId)
      .single();
    if (!error && data) attempt = data as ExamAttempt;
  }

  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  // Verify attempt ownership
  if (attempt.user_id !== studentProfileId) {
    throw new Error('Unauthorized attempt access');
  }

  // Check if attempt is already LOCKED or SUBMITTED
  if (attempt.status === 'LOCKED') {
    return {
      success: true,
      attemptId: attempt.id,
      eventType: input.eventType,
      tabSwitchCount: attempt.tab_switch_count,
      isLocked: true,
      status: 'LOCKED',
      warningMessage: 'Your examination has been temporarily locked. Please contact the exam proctor.',
    };
  }

  if (attempt.status === 'SUBMITTED') {
    return {
      success: true,
      attemptId: attempt.id,
      eventType: input.eventType,
      tabSwitchCount: attempt.tab_switch_count,
      isLocked: false,
      status: 'SUBMITTED',
    };
  }

  // Record proctor event
  const newEventRecord = {
    id: crypto.randomUUID(),
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    paper_id: attempt.paper_id,
    event_type: input.eventType,
    question_index: input.questionIndex,
    metadata: input.metadata || {},
    event_time: nowIso,
    created_at: nowIso,
  };

  if (isTestOrLocal()) {
    mockProctorEvents.push(newEventRecord);
  } else {
    await adminClient.from('proctor_events').insert(newEventRecord);
  }

  // Update last_question_index if provided
  if (input.questionIndex !== undefined && input.questionIndex >= 0) {
    attempt.last_question_index = input.questionIndex;
    if (!isTestOrLocal()) {
      await adminClient
        .from('exam_attempts')
        .update({ last_question_index: input.questionIndex, updated_at: nowIso })
        .eq('id', attempt.id);
    }
  }

  // Evaluate if event is a qualifying violation
  const isQualifyingViolation = QUALIFYING_VIOLATION_EVENTS.includes(input.eventType);

  if (!isQualifyingViolation) {
    return {
      success: true,
      attemptId: attempt.id,
      eventType: input.eventType,
      tabSwitchCount: attempt.tab_switch_count,
      isLocked: false,
      status: attempt.status,
    };
  }

  // Deduplication Check: Look for recent qualifying violation events within cooldown window
  let isDuplicate = false;
  if (isTestOrLocal()) {
    const recentQualifying = mockProctorEvents
      .filter(
        (e) =>
          e.attempt_id === attempt!.id &&
          QUALIFYING_VIOLATION_EVENTS.includes(e.event_type) &&
          e.id !== newEventRecord.id
      )
      .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());

    if (recentQualifying.length > 0) {
      const lastTime = new Date(recentQualifying[0].event_time).getTime();
      if (now.getTime() - lastTime < EVENT_DEDUPLICATION_COOLDOWN_MS) {
        isDuplicate = true;
      }
    }
  } else {
    const { data: recentEvents } = await adminClient
      .from('proctor_events')
      .select('event_time')
      .eq('attempt_id', attempt.id)
      .in('event_type', QUALIFYING_VIOLATION_EVENTS)
      .lt('event_time', nowIso)
      .order('event_time', { ascending: false })
      .limit(1);

    if (recentEvents && recentEvents.length > 0) {
      const lastEventTime = new Date(recentEvents[0].event_time).getTime();
      if (now.getTime() - lastEventTime < EVENT_DEDUPLICATION_COOLDOWN_MS) {
        isDuplicate = true;
      }
    }
  }

  let updatedCount = attempt.tab_switch_count;
  if (!isDuplicate) {
    updatedCount = attempt.tab_switch_count + 1;
  }

  const fullscreenExitCount =
    input.eventType === 'FULLSCREEN_EXIT' && !isDuplicate
      ? (attempt.fullscreen_exit_count || 0) + 1
      : attempt.fullscreen_exit_count || 0;

  // Check 3-Violation Policy
  const shouldLock = updatedCount >= 3;
  const newStatus: AttemptStatus = shouldLock ? 'LOCKED' : attempt.status;

  // Update in memory or DB
  attempt.tab_switch_count = updatedCount;
  attempt.fullscreen_exit_count = fullscreenExitCount;
  attempt.status = newStatus;
  attempt.updated_at = nowIso;

  if (shouldLock) {
    attempt.locked_at = nowIso;
  }

  if (isTestOrLocal()) {
    mockExamStore.attempts.set(attempt.id, { ...attempt });
  } else {
    const updatePayload: Record<string, any> = {
      tab_switch_count: updatedCount,
      fullscreen_exit_count: fullscreenExitCount,
      updated_at: nowIso,
    };
    if (shouldLock) {
      updatePayload.status = 'LOCKED';
      updatePayload.locked_at = nowIso;
    }
    await adminClient.from('exam_attempts').update(updatePayload).eq('id', attempt.id);
  }

  // If locked, insert EXAM_LOCKED proctor event
  if (shouldLock) {
    const lockEventRecord = {
      id: crypto.randomUUID(),
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      paper_id: attempt.paper_id,
      event_type: 'EXAM_LOCKED',
      question_index: input.questionIndex,
      metadata: { reason: '3-violation lockout threshold reached' },
      event_time: nowIso,
      created_at: nowIso,
    };

    if (isTestOrLocal()) {
      mockProctorEvents.push(lockEventRecord);
    } else {
      await adminClient.from('proctor_events').insert(lockEventRecord);
    }
  }

  let warningMessage: string | undefined;
  if (shouldLock) {
    warningMessage = 'Your examination has been temporarily locked. Please contact the exam proctor.';
  } else if (updatedCount === 1) {
    warningMessage = 'Exam integrity warning: 1 integrity event detected. Please remain in the examination window and keep fullscreen mode enabled.';
  } else if (updatedCount === 2) {
    warningMessage = 'Exam integrity warning — 2 events recorded. Next violation will lock your examination!';
  }

  return {
    success: true,
    attemptId: attempt.id,
    eventType: input.eventType,
    tabSwitchCount: updatedCount,
    isLocked: shouldLock,
    status: newStatus,
    warningMessage,
  };
}

/**
 * Get Proctor Dashboard summary metrics and recent integrity events.
 */
export async function getProctorDashboardSummary(paperId?: string) {
  if (isTestOrLocal()) {
    const attempts = Array.from(mockExamStore.attempts.values());
    const filtered = paperId ? attempts.filter((a) => a.paper_id === paperId) : attempts;

    return {
      summary: {
        totalAttempts: filtered.length,
        activeCount: filtered.filter((a) => a.status === 'IN_PROGRESS').length,
        warningCount: filtered.filter((a) => a.status === 'IN_PROGRESS' && a.tab_switch_count > 0).length,
        lockedCount: filtered.filter((a) => a.status === 'LOCKED').length,
        submittedCount: filtered.filter((a) => a.status === 'SUBMITTED').length,
      },
      recentEvents: mockProctorEvents.slice(-15).reverse().map((ev) => ({
        id: ev.id,
        eventType: ev.event_type,
        eventTime: ev.event_time,
        questionIndex: ev.question_index,
        attemptId: ev.attempt_id,
        studentName: 'Test Student',
        username: 'student',
        course: 'MCA',
        paperTitle: 'DCA Computer Fundamentals',
      })),
    };
  }

  const adminClient = createAdminClient();

  let attemptQuery = adminClient.from('exam_attempts').select('id, status, tab_switch_count');
  if (paperId) attemptQuery = attemptQuery.eq('paper_id', paperId);

  const { data: attempts } = await attemptQuery;
  const { count: totalEvents } = await adminClient
    .from('proctor_events')
    .select('id', { count: 'exact', head: true });

  const { data: recentEvs } = await adminClient
    .from('proctor_events')
    .select(`
      id,
      event_type,
      event_time,
      question_index,
      attempt_id,
      profiles!inner ( name, username, course ),
      papers!inner ( title )
    `)
    .order('event_time', { ascending: false })
    .limit(15);

  const allAttempts = attempts || [];
  return {
    summary: {
      totalAttempts: allAttempts.length,
      activeCount: allAttempts.filter((a) => a.status === 'IN_PROGRESS').length,
      warningCount: allAttempts.filter((a) => a.status === 'IN_PROGRESS' && a.tab_switch_count > 0).length,
      lockedCount: allAttempts.filter((a) => a.status === 'LOCKED').length,
      submittedCount: allAttempts.filter((a) => a.status === 'SUBMITTED').length,
    },
    recentEvents: (recentEvs || []).map((ev: any) => ({
      id: ev.id,
      eventType: ev.event_type,
      eventTime: ev.event_time,
      questionIndex: ev.question_index,
      attemptId: ev.attempt_id,
      studentName: ev.profiles?.name || '',
      username: ev.profiles?.username || '',
      course: ev.profiles?.course || '',
      paperTitle: ev.papers?.title || '',
    })),
  };
}

/**
 * List all student exam attempts for Proctor dashboard monitoring table with filtering.
 */
export async function listStudentAttempts(filters: Partial<ProctorAttemptFilter> = {}) {
  if (isTestOrLocal()) {
    const attempts = Array.from(mockExamStore.attempts.values());
    let items = attempts.map((attempt) => {
      let displayStatus: 'NORMAL' | 'WARNING' | 'LOCKED' | 'SUBMITTED' = 'NORMAL';
      if (attempt.status === 'LOCKED') displayStatus = 'LOCKED';
      else if (attempt.status === 'SUBMITTED') displayStatus = 'SUBMITTED';
      else if (attempt.status === 'IN_PROGRESS' && attempt.tab_switch_count > 0) displayStatus = 'WARNING';

      return {
        attemptId: attempt.id,
        userId: attempt.user_id,
        paperId: attempt.paper_id,
        studentName: 'Test Student',
        username: 'student',
        year: '1st Year',
        course: 'DCA Computer Science',
        paperTitle: 'DCA Exam',
        rawStatus: attempt.status,
        displayStatus,
        tabSwitchCount: attempt.tab_switch_count,
        fullscreenExitCount: attempt.fullscreen_exit_count,
        lastQuestionIndex: attempt.last_question_index,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
        submittedAt: attempt.submitted_at,
        lockedAt: attempt.locked_at,
      };
    });

    if (filters.status && filters.status !== 'ALL') {
      items = items.filter((i) => i.displayStatus === filters.status);
    }
    return items;
  }

  const adminClient = createAdminClient();

  let query = adminClient
    .from('exam_attempts')
    .select(`
      id,
      user_id,
      paper_id,
      status,
      started_at,
      expires_at,
      submitted_at,
      locked_at,
      tab_switch_count,
      fullscreen_exit_count,
      last_question_index,
      created_at,
      profiles!inner ( id, name, username, year, course ),
      papers!inner ( id, title, duration_minutes )
    `)
    .order('updated_at', { ascending: false });

  if (filters.paperId) query = query.eq('paper_id', filters.paperId);
  if (filters.course) query = query.eq('profiles.course', filters.course);

  const { data: attempts, error } = await query;
  if (error) throw new Error(`Failed to list student attempts: ${error.message}`);

  let items = (attempts || []).map((attempt: any) => {
    let displayStatus: 'NORMAL' | 'WARNING' | 'LOCKED' | 'SUBMITTED' = 'NORMAL';
    if (attempt.status === 'LOCKED') displayStatus = 'LOCKED';
    else if (attempt.status === 'SUBMITTED') displayStatus = 'SUBMITTED';
    else if (attempt.status === 'IN_PROGRESS' && attempt.tab_switch_count > 0) displayStatus = 'WARNING';

    return {
      attemptId: attempt.id,
      userId: attempt.user_id,
      paperId: attempt.paper_id,
      studentName: attempt.profiles?.name || '',
      username: attempt.profiles?.username || '',
      year: attempt.profiles?.year || '',
      course: attempt.profiles?.course || '',
      paperTitle: attempt.papers?.title || '',
      rawStatus: attempt.status,
      displayStatus,
      tabSwitchCount: attempt.tab_switch_count,
      fullscreenExitCount: attempt.fullscreen_exit_count,
      lastQuestionIndex: attempt.last_question_index,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      submittedAt: attempt.submitted_at,
      lockedAt: attempt.locked_at,
    };
  });

  if (filters.status && filters.status !== 'ALL') {
    items = items.filter((item) => item.displayStatus === filters.status);
  }

  if (filters.search) {
    const s = filters.search.toLowerCase();
    items = items.filter(
      (item) =>
        item.studentName.toLowerCase().includes(s) ||
        item.username.toLowerCase().includes(s)
    );
  }

  return items;
}

export const listProctorStudentAttempts = listStudentAttempts;

/**
 * Fetch detailed attempt info and chronological integrity event timeline for Proctor.
 */
export async function getProctorAttemptDetails(attemptId: string) {
  if (isTestOrLocal()) {
    const attempt = mockExamStore.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    const events = mockProctorEvents
      .filter((e) => e.attempt_id === attemptId)
      .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());

    let displayStatus: 'NORMAL' | 'WARNING' | 'LOCKED' | 'SUBMITTED' = 'NORMAL';
    if (attempt.status === 'LOCKED') displayStatus = 'LOCKED';
    else if (attempt.status === 'SUBMITTED') displayStatus = 'SUBMITTED';
    else if (attempt.status === 'IN_PROGRESS' && attempt.tab_switch_count > 0) displayStatus = 'WARNING';

    return {
      attempt: {
        id: attempt.id,
        userId: attempt.user_id,
        paperId: attempt.paper_id,
        status: attempt.status,
        displayStatus,
        startedAt: attempt.started_at,
        expiresAt: attempt.expires_at,
        submittedAt: attempt.submitted_at,
        lockedAt: attempt.locked_at,
        score: attempt.score,
        totalMarks: attempt.total_marks,
        tabSwitchCount: attempt.tab_switch_count,
        fullscreenExitCount: attempt.fullscreen_exit_count,
        lastQuestionIndex: attempt.last_question_index,
        answeredCount: 0,
      },
      student: {
        id: attempt.user_id,
        name: 'Test Student',
        username: 'student',
        year: '1st Year',
        course: 'DCA Computer Science',
      },
      paper: {
        id: attempt.paper_id,
        title: 'DCA Computer Fundamentals Examination',
        course: 'DCA Computer Science',
        durationMinutes: 60,
        totalMarks: 50,
        requiredQuestionCount: 50,
      },
      events: events.map((e) => ({
        id: e.id,
        eventType: e.event_type as ProctorEventType,
        eventTime: e.event_time,
        questionIndex: e.question_index,
        metadata: e.metadata || {},
      })),
    };
  }

  const adminClient = createAdminClient();

  const { data: attempt, error: attemptErr } = await adminClient
    .from('exam_attempts')
    .select(`
      *,
      profiles ( id, name, username, year, course, role, status ),
      papers ( id, title, course, duration_minutes, total_marks, required_question_count )
    `)
    .eq('id', attemptId)
    .single();

  if (attemptErr || !attempt) throw new Error('Attempt not found');

  const { data: events } = await adminClient
    .from('proctor_events')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('event_time', { ascending: true });

  const { count: answeredCount } = await adminClient
    .from('answers')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attemptId);

  let displayStatus: 'NORMAL' | 'WARNING' | 'LOCKED' | 'SUBMITTED' = 'NORMAL';
  if (attempt.status === 'LOCKED') displayStatus = 'LOCKED';
  else if (attempt.status === 'SUBMITTED') displayStatus = 'SUBMITTED';
  else if (attempt.status === 'IN_PROGRESS' && attempt.tab_switch_count > 0) displayStatus = 'WARNING';

  return {
    attempt: {
      id: attempt.id,
      userId: attempt.user_id,
      paperId: attempt.paper_id,
      status: attempt.status,
      displayStatus,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      submittedAt: attempt.submitted_at,
      lockedAt: attempt.locked_at,
      score: attempt.score,
      totalMarks: attempt.total_marks,
      tabSwitchCount: attempt.tab_switch_count,
      fullscreenExitCount: attempt.fullscreen_exit_count,
      lastQuestionIndex: attempt.last_question_index,
      answeredCount: answeredCount || 0,
    },
    student: {
      id: attempt.profiles?.id,
      name: attempt.profiles?.name,
      username: attempt.profiles?.username,
      year: attempt.profiles?.year,
      course: attempt.profiles?.course,
    },
    paper: {
      id: attempt.papers?.id,
      title: attempt.papers?.title,
      course: attempt.papers?.course,
      durationMinutes: attempt.papers?.duration_minutes,
      totalMarks: attempt.papers?.total_marks,
      requiredQuestionCount: attempt.papers?.required_question_count,
    },
    events: (events || []).map((e: any) => ({
      id: e.id,
      eventType: e.event_type as ProctorEventType,
      eventTime: e.event_time,
      questionIndex: e.question_index,
      metadata: e.metadata || {},
    })),
  };
}

/**
 * Manually lock a student attempt (Proctor/Admin action).
 */
export async function proctorLockAttempt(attemptId: string, proctorUserId: string, reason?: string) {
  const nowIso = new Date().toISOString();

  if (isTestOrLocal()) {
    if (proctorUserId) {
      const callerProfile = mockUserProfiles.get(proctorUserId);
      if (callerProfile && callerProfile.role === 'STUDENT') {
        throw new Error('Unauthorized proctor action: STUDENT role cannot execute proctor actions');
      }
    }

    const attempt = mockExamStore.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status === 'SUBMITTED') throw new Error('Cannot lock a submitted exam attempt');

    attempt.status = 'LOCKED';
    attempt.locked_at = nowIso;
    attempt.updated_at = nowIso;
    mockExamStore.attempts.set(attemptId, { ...attempt });

    mockProctorEvents.push({
      id: crypto.randomUUID(),
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      paper_id: attempt.paper_id,
      event_type: 'EXAM_LOCKED',
      question_index: attempt.last_question_index,
      metadata: { locked_by_proctor: proctorUserId, reason: reason || 'Manual proctor lockout' },
      event_time: nowIso,
      created_at: nowIso,
    });

    return { success: true, status: 'LOCKED' };
  }

  const adminClient = createAdminClient();

  const { data: attempt, error: fetchErr } = await adminClient
    .from('exam_attempts')
    .select('id, user_id, paper_id, status')
    .eq('id', attemptId)
    .single();

  if (fetchErr || !attempt) throw new Error('Attempt not found');
  if (attempt.status === 'SUBMITTED') throw new Error('Cannot lock a submitted exam attempt');

  const { error: updateErr } = await adminClient
    .from('exam_attempts')
    .update({ status: 'LOCKED', locked_at: nowIso, updated_at: nowIso })
    .eq('id', attemptId);

  if (updateErr) throw new Error(`Failed to lock attempt: ${updateErr.message}`);

  await adminClient.from('proctor_events').insert({
    id: crypto.randomUUID(),
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    paper_id: attempt.paper_id,
    event_type: 'EXAM_LOCKED',
    metadata: { locked_by_proctor: proctorUserId, reason: reason || 'Manual proctor lockout' },
    event_time: nowIso,
  });

  return { success: true, status: 'LOCKED' };
}

/**
 * Reopen a locked attempt (Proctor/Admin action).
 */
export async function proctorReopenAttempt(attemptId: string, proctorUserId: string, reason?: string) {
  const now = new Date();
  const nowIso = now.toISOString();

  if (isTestOrLocal()) {
    if (proctorUserId) {
      const callerProfile = mockUserProfiles.get(proctorUserId);
      if (callerProfile && callerProfile.role === 'STUDENT') {
        throw new Error('Unauthorized proctor action: STUDENT role cannot execute proctor actions');
      }
    }

    const attempt = mockExamStore.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status !== 'LOCKED') throw new Error('Only LOCKED attempts can be reopened');

    if (attempt.expires_at) {
      const expireTime = new Date(attempt.expires_at).getTime();
      if (now.getTime() >= expireTime) {
        throw new Error('Attempt cannot be reopened because the exam duration has expired.');
      }
    }

    attempt.status = 'IN_PROGRESS';
    attempt.locked_at = null;
    attempt.updated_at = nowIso;
    mockExamStore.attempts.set(attemptId, { ...attempt });

    mockProctorEvents.push({
      id: crypto.randomUUID(),
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      paper_id: attempt.paper_id,
      event_type: 'EXAM_REOPENED',
      question_index: attempt.last_question_index,
      metadata: { reopened_by_proctor: proctorUserId, reason: reason || 'Manual proctor reopen' },
      event_time: nowIso,
      created_at: nowIso,
    });

    return {
      success: true,
      status: 'IN_PROGRESS',
      attemptId: attempt.id,
      lastQuestionIndex: attempt.last_question_index,
    };
  }

  const adminClient = createAdminClient();

  const { data: attempt, error: fetchErr } = await adminClient
    .from('exam_attempts')
    .select('id, user_id, paper_id, status, expires_at, last_question_index')
    .eq('id', attemptId)
    .single();

  if (fetchErr || !attempt) throw new Error('Attempt not found');
  if (attempt.status !== 'LOCKED') throw new Error('Only LOCKED attempts can be reopened');

  if (attempt.expires_at) {
    const expireTime = new Date(attempt.expires_at).getTime();
    if (now.getTime() >= expireTime) {
      throw new Error('Attempt cannot be reopened because the exam duration has expired.');
    }
  }

  const { error: updateErr } = await adminClient
    .from('exam_attempts')
    .update({ status: 'IN_PROGRESS', locked_at: null, updated_at: nowIso })
    .eq('id', attemptId);

  if (updateErr) throw new Error(`Failed to reopen attempt: ${updateErr.message}`);

  await adminClient.from('proctor_events').insert({
    id: crypto.randomUUID(),
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    paper_id: attempt.paper_id,
    event_type: 'EXAM_REOPENED',
    question_index: attempt.last_question_index,
    metadata: { reopened_by_proctor: proctorUserId, reason: reason || 'Manual proctor reopen' },
    event_time: nowIso,
  });

  return {
    success: true,
    status: 'IN_PROGRESS',
    attemptId: attempt.id,
    lastQuestionIndex: attempt.last_question_index,
  };
}
