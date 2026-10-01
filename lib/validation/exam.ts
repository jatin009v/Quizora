import { z } from 'zod';

export const SaveAnswerSchema = z.object({
  attemptId: z.string().uuid({ message: 'Invalid attempt ID format' }),
  questionId: z.string().uuid({ message: 'Invalid question ID format' }),
  selectedOption: z.string().min(1, { message: 'Selected option is required' }),
  clientTimestamp: z.number().optional(),
});

export type SaveAnswerInput = z.infer<typeof SaveAnswerSchema>;

export const SaveProgressSchema = z.object({
  attemptId: z.string().uuid({ message: 'Invalid attempt ID format' }),
  questionIndex: z.number().int().min(0, { message: 'Question index must be non-negative' }),
});

export type SaveProgressInput = z.infer<typeof SaveProgressSchema>;
