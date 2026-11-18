import { z } from 'zod';
import { SORT_FIELDS, STATUSES } from './types';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Not a real date');

// Empty strings from a form are treated as "not set".
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const taskFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.preprocess(
    blankToNull,
    z.string().trim().max(2000, 'Description must be 2000 characters or fewer').nullable(),
  ),
  dueDate: z.preprocess(blankToNull, dateOnly.nullable()),
  status: z.enum(STATUSES),
});

export const createTaskSchema = taskFields.extend({
  description: taskFields.shape.description.optional().default(null),
  dueDate: taskFields.shape.dueDate.optional().default(null),
  status: taskFields.shape.status.optional().default('todo'),
});

export const updateTaskSchema = taskFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(SORT_FIELDS).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be 72 characters or fewer'),
});
