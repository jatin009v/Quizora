import { z } from 'zod';

export const ProctorEventTypeSchema = z.enum([
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'WINDOW_FOCUS',
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'EXAM_STARTED',
  'EXAM_SUBMITTED',
  'EXAM_LOCKED',
  'EXAM_REOPENED',
  'RECONNECTED',
  'DISCONNECTED',
  'PAGE_REFRESH',
]);

export const ProctorEventInputSchema = z.object({
  attemptId: z.string().uuid({ message: 'Valid attempt ID is required' }),
  eventType: ProctorEventTypeSchema,
  questionIndex: z.number().int().min(0).default(0),
  metadata: z.record(z.any()).optional(),
});

export const ProctorAttemptFilterSchema = z.object({
  status: z.enum(['ALL', 'NORMAL', 'WARNING', 'LOCKED', 'SUBMITTED']).optional().default('ALL'),
  paperId: z.string().uuid().optional(),
  course: z.string().optional(),
  search: z.string().optional(),
});

export const ProctorLockActionSchema = z.object({
  reason: z.string().optional().default('Proctor manual lock'),
});

export const ProctorReopenActionSchema = z.object({
  reason: z.string().optional().default('Proctor manual reopen'),
});

export type ProctorEventInput = z.infer<typeof ProctorEventInputSchema>;
export type ProctorAttemptFilter = z.infer<typeof ProctorAttemptFilterSchema>;
