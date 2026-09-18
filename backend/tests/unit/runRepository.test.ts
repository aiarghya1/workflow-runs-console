import { describe, expect, it } from 'vitest';
import { RunRepository } from '../../src/repositories/runRepository';
import { makeRun } from '../helpers';

const seed = [
  makeRun({ id: 'run-1', workflowName: 'Contract-Review', status: 'failed', startedAt: '2026-04-09T08:00:00Z' }),
  makeRun({ id: 'run-2', workflowName: 'invoice-extraction', status: 'success', startedAt: '2026-04-09T09:00:00Z' }),
  makeRun({ id: 'run-3', workflowName: 'legal-review', status: 'running', startedAt: '2026-04-09T08:30:00Z' }),
];

describe('RunRepository', () => {
  it('lists summaries (no steps) newest first', () => {
    const items = new RunRepository(seed).list();
    expect(items.map((run) => run.id)).toEqual(['run-2', 'run-3', 'run-1']);
    expect(items[0]).not.toHaveProperty('steps');
  });

  it('filters by status', () => {
    expect(new RunRepository(seed).list({ status: 'failed' }).map((run) => run.id)).toEqual(['run-1']);
  });

  it('searches workflowName case-insensitively', () => {
    const repository = new RunRepository(seed);
    expect(repository.list({ search: 'REVIEW' }).map((run) => run.id)).toEqual(['run-3', 'run-1']);
    expect(repository.list({ search: 'review', status: 'running' }).map((run) => run.id)).toEqual(['run-3']);
    expect(repository.list({ search: 'nothing' })).toEqual([]);
  });

  it('returns copies so callers cannot mutate stored state', () => {
    const repository = new RunRepository(seed);
    const run = repository.findById('run-1')!;
    run.status = 'success';
    run.steps[0]!.status = 'failed';
    expect(repository.findById('run-1')).toEqual(seed[0]);
  });

  it('does not share state with the seed array', () => {
    const local = [makeRun()];
    const repository = new RunRepository(local);
    local[0]!.retries = 99;
    expect(repository.findById('run-1')!.retries).toBe(0);
  });

  it('returns undefined for unknown runs', () => {
    expect(new RunRepository(seed).findById('nope')).toBeUndefined();
  });

  it('saves updates and returns a detached copy', () => {
    const repository = new RunRepository(seed);
    const saved = repository.save({ ...makeRun(), retries: 3 });
    saved.retries = 100;
    expect(repository.findById('run-1')!.retries).toBe(3);
  });
});
