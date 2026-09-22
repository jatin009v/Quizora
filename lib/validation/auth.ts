import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  course: z.string().min(2, { message: 'Course is required' }),
  year: z.string().default('1st Year'),
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters' })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, hyphens, and underscores' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  role: z.enum(['STUDENT', 'PROCTOR', 'ADMIN']).default('STUDENT'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserStatusSchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user ID format' }),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
