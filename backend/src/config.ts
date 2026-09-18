import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Probability (0..1) that a simulated step fails during a retry. */
  RETRY_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.25),
  /** How long each simulated step takes to complete during a retry. */
  STEP_DURATION_MS: z.coerce.number().int().min(10).max(60_000).default(1500),
  IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  IDEMPOTENCY_MAX_ENTRIES: z.coerce.number().int().positive().default(1000),
  RETRY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
});

export type Config = z.infer<typeof envSchema>;

/** Parses and validates configuration once at startup; fails fast on bad input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration: ${problems.join('; ')}`);
  }
  return result.data;
}
