import type { RetryAction, WorkflowRun } from '@app/shared';
import { delay, http, HttpResponse } from 'msw';
import fixtures from '../../../fixtures/workflow-runs.json';

/**
 * Stateful fake of the API, mirroring the backend's retry rules closely enough for UI tests.
 * A retried run completes on the next detail fetch so polling can be observed quickly.
 */
export const db = {
  runs: [] as WorkflowRun[],
  retryRequests: [] as RetryAction[],
  completing: new Set<string>(),
  reset() {
    this.runs = structuredClone(fixtures) as WorkflowRun[];
    this.retryRequests = [];
    this.completing.clear();
  },
  find(id: string) {
    return this.runs.find((run) => run.id === id);
  },
};

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
    if (db.completing.has(run.id)) {
      db.completing.delete(run.id);
      run.status = 'success';
      run.steps = run.steps.map(({ name }) => ({ name, status: 'success' }));
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
    db.completing.add(run.id);
    return HttpResponse.json({ run }, { status: 202 });
  }),
];
