import type { ListRunsQuery, WorkflowRun, WorkflowRunSummary } from '@app/shared';

/**
 * In-memory store of workflow runs. All reads/writes go through structuredClone so callers
 * can never mutate stored state by accident; only `save` changes what is stored.
 */
export class RunRepository {
  private readonly runs = new Map<string, WorkflowRun>();

  constructor(seed: readonly WorkflowRun[]) {
    for (const run of seed) this.runs.set(run.id, structuredClone(run));
  }

  /** Newest first; `search` is a case-insensitive substring match on workflowName. */
  list({ status, search }: ListRunsQuery = {}): WorkflowRunSummary[] {
    const needle = search?.toLowerCase();
    const results: WorkflowRunSummary[] = [];
    for (const run of this.runs.values()) {
      if (status && run.status !== status) continue;
      if (needle && !run.workflowName.toLowerCase().includes(needle)) continue;
      const { steps: _steps, ...summary } = run;
      results.push(summary);
    }
    return results.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  findById(id: string): WorkflowRun | undefined {
    const run = this.runs.get(id);
    return run && structuredClone(run);
  }

  save(run: WorkflowRun): WorkflowRun {
    this.runs.set(run.id, structuredClone(run));
    return structuredClone(run);
  }
}
