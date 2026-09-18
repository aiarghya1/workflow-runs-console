import type { ZodType } from 'zod';
import { badRequest } from '../lib/errors';

/** Parses untrusted input with a schema, converting failures into a 400 with field-level details. */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown, what: string): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join('.') || what,
    message: issue.message,
  }));
  throw badRequest(`Invalid ${what}`, details);
}
