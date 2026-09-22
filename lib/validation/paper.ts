import { z } from 'zod';

export const PaperQuestionItemSchema = z.object({
  questionId: z.string().uuid({ message: 'Invalid question ID format' }),
  questionOrder: z.number().int().min(1, { message: 'Question order must be at least 1' }),
  marks: z.number().positive().optional(),
});

export const CreatePaperSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3, { message: 'Quiz name must be at least 3 characters' }),
  description: z.string().nullable().optional(),
  course: z.string().min(2, { message: 'Course name is required' }),
  durationMinutes: z.number().int().min(1, { message: 'Duration must be at least 1 minute' }),
  requiredQuestionCount: z.number().int().min(1, { message: 'Required questions must be > 0' }),
  totalMarks: z.number().positive({ message: 'Total marks must be > 0' }),
  markingMode: z.enum(['EQUAL_MARKS', 'CUSTOM']).default('EQUAL_MARKS'),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  selectedQuestions: z.array(PaperQuestionItemSchema).min(1, { message: 'At least one question must be selected' }),
});

export type CreatePaperInput = z.infer<typeof CreatePaperSchema>;

export const SubmitExamSchema = z.object({
  attemptId: z.string().uuid({ message: 'Invalid attempt ID format' }),
});

export type SubmitExamInput = z.infer<typeof SubmitExamSchema>;
