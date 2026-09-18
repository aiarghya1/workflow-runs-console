import type { WorkflowRun } from '@app/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunRepository } from '../../src/repositories/runRepository';
import { RunExecutor } from '../../src/services/runExecutor';
import { makeRun, silentLogger } from '../helpers';

const runningRun = (): WorkflowRun =>
  makeRun({
    status: 'running',
    errorMessage: undefined,
    steps: [
      { name: 'ingest', status: 'success' },
      { name: 'retrieve', status: 'success' },
      { name: 'generate', status: 'running' },
      { name: 'review', status: 'pending' },
    ],
  });

const setup = (run: WorkflowRun, random: () => number, failureRate = 0.5) => {
  const repository = new RunRepository([run]);
  const executor = new RunExecutor({ repository, logger: silentLogger(), stepDurationMs: 100, failureRate, random });
  return { repository, executor };
};

describe('RunExecutor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('advances step by step until the run succeeds', () => {
    const { repository, executor } = setup(runningRun(), () => 0.9);
    executor.schedule('run-1');

    vi.advanceTimersByTime(100);
    let run = repository.findById('run-1')!;
    expect(run.steps.map((step) => step.status)).toEqual(['success', 'success', 'success', 'running']);
    expect(run.status).toBe('running');
    expect(run.latencyMs).toBe(1100);
    expect(run.tokenCount).toBe(3000);

    vi.advanceTimersByTime(100);
    run = repository.findById('run-1')!;
    expect(run.status).toBe('success');
    expect(run.steps.every((step) => step.status === 'success')).toBe(true);
    expect(executor.isScheduled('run-1')).toBe(false);
  });

  it('fails the run with a descriptive error when a step fails', () => {
    const { repository, executor } = setup(runningRun(), () => 0.1);
    executor.schedule('run-1');
    vi.advanceTimersByTime(100);

    const run = repository.findById('run-1')!;
    expect(run.status).toBe('failed');
    expect(run.errorMessage).toBe('LLM provider timeout during generate step');
    expect(run.steps[2]).toEqual({ name: 'generate', status: 'failed', errorMessage: 'LLM provider timeout' });
    expect(run.steps[3]!.status).toBe('pending');
  });

  it('uses a specific failure message for every step type', () => {
    const messages = (['ingest', 'retrieve', 'review'] as const).map((name) => {
      const run = makeRun({ status: 'running', steps: [{ name, status: 'running' }] });
      const { repository, executor } = setup(run, () => 0);
      executor.schedule('run-1');
      vi.advanceTimersByTime(100);
      return repository.findById('run-1')!.errorMessage;
    });
    expect(messages).toEqual([
      'Document parser crashed during ingest step',
      'Vector store unavailable during retrieve step',
      'Human review callback expired during review step',
    ]);
  });

  it('clears stale step error messages on success', () => {
    const run = makeRun({ status: 'running', steps: [{ name: 'ingest', status: 'running', errorMessage: 'old' }] });
    const { repository, executor } = setup(run, () => 1);
    executor.schedule('run-1');
    vi.advanceTimersByTime(100);
    expect(repository.findById('run-1')!.steps[0]).toEqual({ name: 'ingest', status: 'success' });
  });

  it('ignores runs that disappeared or have no running step', () => {
    const { repository, executor } = setup(makeRun(), () => 1);
    executor.schedule('run-1');
    executor.schedule('ghost');
    vi.advanceTimersByTime(100);
    expect(repository.findById('run-1')).toEqual(makeRun());
  });

  it('rescheduling replaces the pending timer instead of double-advancing', () => {
    const { repository, executor } = setup(runningRun(), () => 1);
    executor.schedule('run-1');
    executor.schedule('run-1');
    vi.advanceTimersByTime(100);
    expect(repository.findById('run-1')!.steps[3]!.status).toBe('running');
  });

  it('stop() cancels all pending work', () => {
    const { repository, executor } = setup(runningRun(), () => 1);
    executor.schedule('run-1');
    executor.stop();
    vi.advanceTimersByTime(1000);
    expect(repository.findById('run-1')!.steps[2]!.status).toBe('running');
    expect(executor.isScheduled('run-1')).toBe(false);
  });

  it('defaults to Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const repository = new RunRepository([runningRun()]);
    const executor = new RunExecutor({ repository, logger: silentLogger(), stepDurationMs: 100, failureRate: 0.5 });
    executor.schedule('run-1');
    vi.advanceTimersByTime(100);
    expect(Math.random).toHaveBeenCalled();
    expect(repository.findById('run-1')!.steps[2]!.status).toBe('success');
  });
});
