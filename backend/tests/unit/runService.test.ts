import type { RetryAction } from '@app/shared';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors';
import { IdempotencyStore } from '../../src/lib/idempotencyStore';
import { RunRepository } from '../../src/repositories/runRepository';
import type { RunExecutor } from '../../src/services/runExecutor';
import { RunService, type RetryRecord } from '../../src/services/runService';
import { makeRun, OTHER_REQUEST_ID, REQUEST_ID, silentLogger } from '../helpers';

const setup = (runs = [makeRun()]) => {
  const repository = new RunRepository(runs);
  const executor = { schedule: vi.fn() } as unknown as RunExecutor;
  const idempotency = new IdempotencyStore<RetryRecord>({ ttlMs: 60_000, maxEntries: 100 });
  const service = new RunService({ repository, executor, idempotency, logger: silentLogger() });
  return { service, repository, executor };
};

const fullRun: RetryAction = { runId: 'run-1', mode: 'full_run', requestId: REQUEST_ID };

const expectAppError = (fn: () => unknown, status: number, code: string) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status, code });
    return;
  }
  throw new Error('expected an AppError');
};

describe('RunService.listRuns / getRun', () => {
  it('delegates list queries to the repository', () => {
    expect(setup().service.listRuns({ status: 'success' })).toEqual([]);
  });

  it('returns a run or throws 404', () => {
    const { service } = setup();
    expect(service.getRun('run-1').id).toBe('run-1');
    expectAppError(() => service.getRun('missing'), 404, 'NOT_FOUND');
  });
});

describe('RunService.retryRun', () => {
  it('full_run restarts every step and schedules execution', () => {
    const { service, executor, repository } = setup();
    const { run, replayed } = service.retryRun('run-1', fullRun);

    expect(replayed).toBe(false);
    expect(run.status).toBe('running');
    expect(run.retries).toBe(1);
    expect(run).not.toHaveProperty('errorMessage');
    expect(run.steps).toEqual([
      { name: 'ingest', status: 'running' },
      { name: 'retrieve', status: 'pending' },
      { name: 'generate', status: 'pending' },
      { name: 'review', status: 'pending' },
    ]);
    expect(repository.findById('run-1')).toEqual(run);
    expect(executor.schedule).toHaveBeenCalledWith('run-1');
  });

  it('failed_step reruns only the failed step and keeps earlier successes', () => {
    const { service } = setup();
    const { run } = service.retryRun('run-1', { runId: 'run-1', mode: 'failed_step', stepName: 'generate' });
    expect(run.steps.map((step) => step.status)).toEqual(['success', 'success', 'running', 'pending']);
    expect(run.steps[2]).not.toHaveProperty('errorMessage');
  });

  it('rejects failed_step for a step that is not the failed one', () => {
    const { service } = setup();
    const action: RetryAction = { runId: 'run-1', mode: 'failed_step', stepName: 'review' };
    expectAppError(() => service.retryRun('run-1', action), 409, 'STEP_NOT_RETRYABLE');
  });

  it('rejects failed_step when the run has no failed step', () => {
    const { service } = setup([makeRun({ steps: [{ name: 'ingest', status: 'success' }] })]);
    const action: RetryAction = { runId: 'run-1', mode: 'failed_step', stepName: 'ingest' };
    expectAppError(() => service.retryRun('run-1', action), 409, 'STEP_NOT_RETRYABLE');
  });

  it.each(['running', 'success'] as const)('rejects retrying a %s run', (status) => {
    const { service, executor } = setup([makeRun({ status })]);
    expectAppError(() => service.retryRun('run-1', fullRun), 409, 'RUN_NOT_RETRYABLE');
    expect(executor.schedule).not.toHaveBeenCalled();
  });

  it('rejects a body runId that does not match the URL', () => {
    expectAppError(() => setup().service.retryRun('run-2', fullRun), 400, 'VALIDATION_ERROR');
  });

  it('404s for unknown runs', () => {
    const { service } = setup();
    expectAppError(() => service.retryRun('run-9', { ...fullRun, runId: 'run-9' }), 404, 'NOT_FOUND');
  });

  it('replays the original result for a repeated requestId without retrying twice', () => {
    const { service, executor } = setup();
    const first = service.retryRun('run-1', fullRun);
    const second = service.retryRun('run-1', fullRun);

    expect(second).toEqual({ run: first.run, replayed: true });
    expect(executor.schedule).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a requestId for a different retry', () => {
    const { service } = setup();
    service.retryRun('run-1', fullRun);
    const different: RetryAction = { ...fullRun, mode: 'failed_step', stepName: 'generate' };
    expectAppError(() => service.retryRun('run-1', different), 422, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('blocks a second retry with a new requestId while the first is running', () => {
    const { service } = setup();
    service.retryRun('run-1', fullRun);
    expectAppError(() => service.retryRun('run-1', { ...fullRun, requestId: OTHER_REQUEST_ID }), 409, 'RUN_NOT_RETRYABLE');
  });

  it('works without a requestId (state guard still applies)', () => {
    const { service } = setup();
    const { requestId: _omit, ...action } = fullRun;
    expect(service.retryRun('run-1', action).run.retries).toBe(1);
    expectAppError(() => service.retryRun('run-1', action), 409, 'RUN_NOT_RETRYABLE');
  });
});
