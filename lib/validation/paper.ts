import { z } from 'zod';

export const PaperQuestionItemSchema = z.object({
  questionId: z.string().uuid({ message: 'Invalid question ID format' }),
  questionOrder: z.number().int().min(1, { message: 'Question order must be at least 1' }),
  marks: z.number().positive().optional(),
});

export const CreatePaperSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().min(3, { message: 'Quiz name must be at least 3 characters' }),
    description: z.string().nullable().optional(),
    course: z.string().min(2, { message: 'Course name is required' }),
    durationMinutes: z.number().int().min(1, { message: 'Duration must be at least 1 minute' }),
    requiredQuestionCount: z.number().int().min(1, { message: 'Required questions must be > 0' }),
    totalMarks: z.number().positive({ message: 'Total marks must be > 0' }),
    markingMode: z.enum(['EQUAL_MARKS', 'CUSTOM']).default('EQUAL_MARKS'),
    accessCode: z.string().nullable().optional(),
    startAt: z.string().nullable().optional(),
    endAt: z.string().nullable().optional(),
    showResultToStudent: z.boolean().optional().default(false),
    shuffleQuestions: z.boolean().optional().default(true),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional().default('DRAFT'),
    selectedQuestions: z.array(PaperQuestionItemSchema).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.startAt).getTime() < new Date(data.endAt).getTime();
      }
      return true;
    },
    {
      message: 'Exam access start time must be before end time.',
      path: ['endAt'],
    }
  );

export type CreatePaperInput = z.input<typeof CreatePaperSchema>;

export const SubmitExamSchema = z.object({
  attemptId: z.string().uuid({ message: 'Invalid attempt ID format' }),
});

export type SubmitExamInput = z.infer<typeof SubmitExamSchema>;
