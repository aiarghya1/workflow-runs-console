import type { StepName, WorkflowRun } from '@app/shared';
import type { Logger } from '../lib/logger';
import type { RunRepository } from '../repositories/runRepository';

export type RunExecutorOptions = {
  repository: RunRepository;
  logger: Logger;
  stepDurationMs: number;
  failureRate: number;
  random?: () => number;
};

const FAILURE_MESSAGES: Record<StepName, string> = {
  ingest: 'Document parser crashed',
  retrieve: 'Vector store unavailable',
  generate: 'LLM provider timeout',
  review: 'Human review callback expired',
};

/** Rough per-step token cost so retried runs show plausible metric changes. */
const STEP_TOKENS: Record<StepName, number> = { ingest: 0, retrieve: 400, generate: 2500, review: 150 };

/**
 * Simulates the workflow engine: advances the currently running step on a timer until
 * the run succeeds or a step fails. Stands in for a real queue/worker in this exercise.
 */
export class RunExecutor {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly random: () => number;

  constructor(private readonly options: RunExecutorOptions) {
    this.random = options.random ?? Math.random;
  }

  schedule(runId: string): void {
    clearTimeout(this.timers.get(runId));
    const timer = setTimeout(() => this.advance(runId), this.options.stepDurationMs);
    timer.unref();
    this.timers.set(runId, timer);
  }

  isScheduled(runId: string): boolean {
    return this.timers.has(runId);
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private advance(runId: string): void {
    this.timers.delete(runId);
    const { repository, logger, stepDurationMs, failureRate } = this.options;
    const run = repository.findById(runId);
    const step = run?.steps.find((candidate) => candidate.status === 'running');
    if (!run || !step) return;

    run.latencyMs += stepDurationMs;
    run.tokenCount += STEP_TOKENS[step.name];

    if (this.random() < failureRate) {
      step.status = 'failed';
      step.errorMessage = FAILURE_MESSAGES[step.name];
      run.status = 'failed';
      run.errorMessage = `${step.errorMessage} during ${step.name} step`;
      repository.save(run);
      logger.warn({ runId, step: step.name }, 'run step failed');
      return;
    }

    step.status = 'success';
    delete step.errorMessage;
    const next = nextPendingStep(run);
    if (next) {
      next.status = 'running';
      repository.save(run);
      this.schedule(runId);
      return;
    }

    run.status = 'success';
    repository.save(run);
    logger.info({ runId, retries: run.retries }, 'run completed');
  }
}

function nextPendingStep(run: WorkflowRun) {
  return run.steps.find((step) => step.status === 'pending');
}
