import type { RetryAction, WorkflowRun } from '@app/shared';
import { delay, http, HttpResponse } from 'msw';
import fixtures from '../../../fixtures/workflow-runs.json';

/**
 * Stateful fake of the API, mirroring the backend's retry rules closely enough for UI tests.
 * A retried run finishes on its second detail fetch (i.e. after one poll), with `db.retryOutcome`.
 */
export const db = {
  runs: [] as WorkflowRun[],
  retryRequests: [] as RetryAction[],
  /** run id -> detail fetches left before the retried run finishes */
  completing: new Map<string, number>(),
  retryOutcome: 'success' as 'success' | 'failed',
  reset() {
    this.runs = structuredClone(fixtures) as WorkflowRun[];
    this.retryRequests = [];
    this.completing.clear();
    this.retryOutcome = 'success';
  },
  find(id: string) {
    return this.runs.find((run) => run.id === id);
  },
};

function finishRun(run: WorkflowRun, outcome: 'success' | 'failed') {
  run.status = outcome;
  if (outcome === 'success') {
    run.steps = run.steps.map(({ name }) => ({ name, status: 'success' }));
    return;
  }
  run.errorMessage = 'LLM provider timeout during ingest step';
  run.steps = run.steps.map(({ name }, index) =>
    index === 0 ? { name, status: 'failed', errorMessage: 'LLM provider timeout' } : { name, status: 'pending' },
  );
}

const apiError = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

export const handlers = [
  http.get('*/api/runs', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.toLowerCase();
    const items = db.runs
      .filter((run) => !status || run.status === status)
      .filter((run) => !search || run.workflowName.toLowerCase().includes(search))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map(({ steps: _steps, ...summary }) => summary);
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get('*/api/runs/:id', ({ params }) => {
    const run = db.find(String(params.id));
    if (!run) return apiError(404, 'NOT_FOUND', `Run ${String(params.id)} not found`);
    const remaining = db.completing.get(run.id);
    if (remaining !== undefined && remaining > 1) db.completing.set(run.id, remaining - 1);
    else if (remaining !== undefined) {
      db.completing.delete(run.id);
      finishRun(run, db.retryOutcome);
    }
    return HttpResponse.json({ run });
  }),

  http.post('*/api/runs/:id/retry', async ({ request, params }) => {
    const action = (await request.json()) as RetryAction;
    db.retryRequests.push(action);
    await delay(50);
    const run = db.find(String(params.id));
    if (!run) return apiError(404, 'NOT_FOUND', 'Run not found');
    if (run.status !== 'failed') return apiError(409, 'RUN_NOT_RETRYABLE', `Run ${run.id} is ${run.status}; only failed runs can be retried`);
    run.status = 'running';
    run.retries += 1;
    delete run.errorMessage;
    run.steps = run.steps.map((step) =>
      step.status === 'failed' || action.mode === 'full_run' ? { name: step.name, status: 'running' } : step,
    );
    db.completing.set(run.id, 2);
    return HttpResponse.json({ run }, { status: 202 });
  }),
];
