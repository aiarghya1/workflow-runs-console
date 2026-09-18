import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  errorResponseSchema,
  listRunsQuerySchema,
  retryActionSchema,
  runIdSchema,
  SEARCH_MAX_LENGTH,
  workflowRunSchema,
} from '../src';

const fixturesPath = fileURLToPath(new URL('../../fixtures/workflow-runs.json', import.meta.url));
const fixtures: unknown[] = JSON.parse(readFileSync(fixturesPath, 'utf8'));

describe('workflowRunSchema', () => {
  it('accepts every fixture run', () => {
    for (const run of fixtures) {
      expect(workflowRunSchema.safeParse(run).success).toBe(true);
    }
  });

  it('rejects unknown properties (additionalProperties: false)', () => {
    const run = { ...(fixtures[0] as object), extra: true };
    expect(workflowRunSchema.safeParse(run).success).toBe(false);
  });

  it('rejects negative metrics and bad statuses', () => {
    const base = fixtures[0] as Record<string, unknown>;
    expect(workflowRunSchema.safeParse({ ...base, latencyMs: -1 }).success).toBe(false);
    expect(workflowRunSchema.safeParse({ ...base, status: 'queued' }).success).toBe(false);
    expect(workflowRunSchema.safeParse({ ...base, startedAt: 'yesterday' }).success).toBe(false);
  });
});

describe('retryActionSchema', () => {
  const requestId = '7b0f2a7e-6a0e-4d5b-9a51-0b1f8a3c2d11';

  it('accepts a full_run retry without stepName', () => {
    expect(retryActionSchema.safeParse({ runId: 'run-1', mode: 'full_run', requestId }).success).toBe(true);
  });

  it('requires stepName for failed_step', () => {
    const result = retryActionSchema.safeParse({ runId: 'run-1', mode: 'failed_step' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['stepName']);
  });

  it('accepts failed_step with stepName', () => {
    const action = { runId: 'run-1', mode: 'failed_step', stepName: 'generate' };
    expect(retryActionSchema.safeParse(action).success).toBe(true);
  });

  it('rejects malformed requestId, unknown mode and extra keys', () => {
    expect(retryActionSchema.safeParse({ runId: 'run-1', mode: 'full_run', requestId: 'abc' }).success).toBe(false);
    expect(retryActionSchema.safeParse({ runId: 'run-1', mode: 'partial' }).success).toBe(false);
    expect(retryActionSchema.safeParse({ runId: 'run-1', mode: 'full_run', admin: true }).success).toBe(false);
  });
});

describe('runIdSchema', () => {
  it('only allows safe identifier characters', () => {
    expect(runIdSchema.safeParse('run-1001').success).toBe(true);
    expect(runIdSchema.safeParse('../etc/passwd').success).toBe(false);
    expect(runIdSchema.safeParse('a'.repeat(65)).success).toBe(false);
  });
});

describe('listRunsQuerySchema', () => {
  it('trims search and bounds its length', () => {
    expect(listRunsQuerySchema.parse({ search: '  legal ' })).toEqual({ search: 'legal' });
    expect(listRunsQuerySchema.safeParse({ search: 'x'.repeat(SEARCH_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it('rejects unknown statuses and unknown params', () => {
    expect(listRunsQuerySchema.safeParse({ status: 'queued' }).success).toBe(false);
    expect(listRunsQuerySchema.safeParse({ page: '2' }).success).toBe(false);
  });
});

describe('errorResponseSchema', () => {
  it('accepts an error envelope with optional details', () => {
    const body = { error: { code: 'X', message: 'y', details: [{ path: 'a', message: 'b' }] } };
    expect(errorResponseSchema.safeParse(body).success).toBe(true);
  });
});
