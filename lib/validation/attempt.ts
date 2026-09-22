import { z } from 'zod';

export const AccessCodeSchema = z.object({
  accessCode: z.string().min(4, { message: 'Access code must be at least 4 characters' }).max(20),
});

export type AccessCodeInput = z.infer<typeof AccessCodeSchema>;

export const StartExamSchema = z.object({
  paperId: z.string().uuid({ message: 'Invalid paper ID format' }),
});

export type StartExamInput = z.infer<typeof StartExamSchema>;
