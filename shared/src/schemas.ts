import { z } from 'zod';

/**
 * Runtime mirrors of shared/contracts/*.schema.json.
 * Both the API (request validation) and the UI (response validation) use these,
 * so the contract is enforced at every boundary rather than only at compile time.
 */

export const RUN_STATUSES = ['success', 'running', 'failed'] as const;
export const STEP_STATUSES = ['success', 'running', 'failed', 'pending'] as const;
export const STEP_NAMES = ['ingest', 'retrieve', 'generate', 'review'] as const;
export const RETRY_MODES = ['full_run', 'failed_step'] as const;

export const SEARCH_MAX_LENGTH = 100;
export const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const runStatusSchema = z.enum(RUN_STATUSES);
export const stepStatusSchema = z.enum(STEP_STATUSES);
export const stepNameSchema = z.enum(STEP_NAMES);
export const retryModeSchema = z.enum(RETRY_MODES);
export const runIdSchema = z.string().regex(RUN_ID_PATTERN, 'Invalid run id');

export const workflowStepSchema = z.strictObject({
  name: stepNameSchema,
  status: stepStatusSchema,
  errorMessage: z.string().optional(),
});

const nonNegativeInt = z.number().int().min(0);

export const workflowRunSummarySchema = z.strictObject({
  id: runIdSchema,
  workflowName: z.string(),
  status: runStatusSchema,
  startedAt: z.iso.datetime(),
  latencyMs: nonNegativeInt,
  tokenCount: nonNegativeInt,
  retries: nonNegativeInt,
  errorMessage: z.string().optional(),
});

export const workflowRunSchema = workflowRunSummarySchema.extend({
  steps: z.array(workflowStepSchema),
});

export const retryActionSchema = z
  .strictObject({
    runId: runIdSchema,
    mode: retryModeSchema,
    stepName: stepNameSchema.optional(),
    requestId: z.uuid().optional(),
  })
  .refine((action) => action.mode !== 'failed_step' || action.stepName !== undefined, {
    message: 'stepName is required when mode is failed_step',
    path: ['stepName'],
  });

export const listRunsQuerySchema = z.strictObject({
  status: runStatusSchema.optional(),
  search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
});

export const listRunsResponseSchema = z.strictObject({
  items: z.array(workflowRunSummarySchema),
  total: nonNegativeInt,
});

export const runResponseSchema = z.strictObject({ run: workflowRunSchema });

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    details: z.array(z.strictObject({ path: z.string(), message: z.string() })).optional(),
  }),
});

export type RunStatus = z.infer<typeof runStatusSchema>;
export type StepStatus = z.infer<typeof stepStatusSchema>;
export type StepName = z.infer<typeof stepNameSchema>;
export type RetryMode = z.infer<typeof retryModeSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowRunSummary = z.infer<typeof workflowRunSummarySchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type RetryAction = z.infer<typeof retryActionSchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type ListRunsResponse = z.infer<typeof listRunsResponseSchema>;
export type RunResponse = z.infer<typeof runResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
