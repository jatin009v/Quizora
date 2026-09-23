export type UserRole = 'ADMIN' | 'PROCTOR' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type QuestionType = 'MCQ_SINGLE' | 'MCQ_MULTIPLE';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type PaperStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type MarkingMode = 'EQUAL_MARKS' | 'CUSTOM';
export type AttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'LOCKED' | 'SUBMITTED';

export type ProctorEventType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'WINDOW_FOCUS'
  | 'FULLSCREEN_EXIT'
  | 'FULLSCREEN_ENTER'
  | 'EXAM_STARTED'
  | 'EXAM_SUBMITTED'
  | 'EXAM_LOCKED'
  | 'EXAM_REOPENED'
  | 'RECONNECTED'
  | 'DISCONNECTED'
  | 'PAGE_REFRESH';

export interface Profile {
  id: string;
  auth_user_id: string;
  name: string;
  course: string;
  year: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  difficulty: DifficultyLevel;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: string; // SENSITIVE: Hidden from student-facing payloads
  explanation?: string;
  code_snippet?: string;
  image_url?: string;
  marks: number;
  created_at: string;
  updated_at: string;
}

// Client-safe view of question without sensitive grading data
export type ClientQuestion = Omit<Question, 'correct_option' | 'explanation'>;

export interface Paper {
  id: string;
  title: string;
  description: string | null;
  course: string;
  duration_minutes: number;
  total_marks: number;
  required_question_count: number;
  marking_mode: MarkingMode;
  status: PaperStatus;
  access_code: string | null;
  start_at: string | null;
  end_at: string | null;
  show_result_to_student: boolean;
  shuffle_questions: boolean;
  created_by: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperQuestion {
  id: string;
  paper_id: string;
  question_id: string;
  question_order: number;
  marks: number;
  created_at: string;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  paper_id: string;
  status: AttemptStatus;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  locked_at: string | null;
  score: number | null;
  total_marks: number;
  tab_switch_count: number;
  fullscreen_exit_count: number;
  last_question_index: number;
  question_order?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean | null;
  marks_awarded: number | null;
  answered_at: string;
  updated_at: string;
}

export interface ProctorEvent {
  id: string;
  attempt_id: string;
  user_id: string;
  paper_id: string;
  event_type: ProctorEventType;
  event_time: string;
  question_index: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}
