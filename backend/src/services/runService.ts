import type { ListRunsQuery, RetryAction, WorkflowRun, WorkflowRunSummary } from '@app/shared';
import { AppError, badRequest, conflict, notFound } from '../lib/errors';
import type { IdempotencyStore } from '../lib/idempotencyStore';
import type { Logger } from '../lib/logger';
import type { RunRepository } from '../repositories/runRepository';
import type { RunExecutor } from './runExecutor';

export type RetryRecord = { fingerprint: string; run: WorkflowRun };
export type RetryResult = { run: WorkflowRun; replayed: boolean };

export type RunServiceDeps = {
  repository: RunRepository;
  executor: RunExecutor;
  idempotency: IdempotencyStore<RetryRecord>;
  logger: Logger;
};

export class RunService {
  constructor(private readonly deps: RunServiceDeps) {}

  listRuns(query: ListRunsQuery): WorkflowRunSummary[] {
    return this.deps.repository.list(query);
  }

  getRun(id: string): WorkflowRun {
    const run = this.deps.repository.findById(id);
    if (!run) throw notFound(`Run ${id} not found`);
    return run;
  }

  /**
   * Retry safety has three layers:
   * 1. Idempotency key: a repeated requestId replays the original response instead of retrying again.
   * 2. State guard: only a `failed` run can be retried, and it flips to `running` immediately,
   *    so a concurrent retry with a different key gets 409.
   * 3. Atomicity: this method is fully synchronous, so on Node's single thread no other request
   *    can interleave between the check and the write.
   */
  retryRun(runId: string, action: RetryAction): RetryResult {
    const { repository, executor, idempotency, logger } = this.deps;
    if (action.runId !== runId) throw badRequest('runId in body must match the run in the URL');

    const fingerprint = JSON.stringify([action.runId, action.mode, action.stepName ?? null]);
    const previous = action.requestId ? idempotency.get(action.requestId) : undefined;
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'requestId was already used for a different retry');
      }
      logger.info({ runId, requestId: action.requestId }, 'retry replayed from idempotency key');
      return { run: previous.run, replayed: true };
    }

    const run = this.getRun(runId);
    if (run.status !== 'failed') {
      throw conflict('RUN_NOT_RETRYABLE', `Run ${runId} is ${run.status}; only failed runs can be retried`);
    }

    if (action.mode === 'failed_step') {
      const failedStep = run.steps.find((step) => step.status === 'failed');
      if (failedStep?.name !== action.stepName) {
        throw conflict('STEP_NOT_RETRYABLE', `Step ${action.stepName} is not the failed step of run ${runId}`);
      }
      resumeFromFailedStep(run);
    } else {
      restartRun(run);
    }

    run.status = 'running';
    run.retries += 1;
    delete run.errorMessage;
    const saved = repository.save(run);
    executor.schedule(runId);

    if (action.requestId) idempotency.set(action.requestId, { fingerprint, run: saved });
    logger.info({ runId, mode: action.mode, retries: saved.retries }, 'retry accepted');
    return { run: saved, replayed: false };
  }
}

/** failed_step: keep successful steps, rerun the failed one; later steps stay pending. */
function resumeFromFailedStep(run: WorkflowRun): void {
  for (const step of run.steps) {
    if (step.status !== 'failed') continue;
    step.status = 'running';
    delete step.errorMessage;
  }
}

/** full_run: every step starts over from the first one. */
function restartRun(run: WorkflowRun): void {
  run.steps.forEach((step, index) => {
    step.status = index === 0 ? 'running' : 'pending';
    delete step.errorMessage;
  });
}
