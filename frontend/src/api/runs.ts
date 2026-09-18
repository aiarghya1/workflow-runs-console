import {
  listRunsResponseSchema,
  runResponseSchema,
  type ListRunsResponse,
  type RetryAction,
  type RunStatus,
  type WorkflowRun,
} from '@app/shared';
import { request } from './client';

export type RunFilters = { status?: RunStatus; search?: string };

export function fetchRuns({ status, search }: RunFilters, signal?: AbortSignal): Promise<ListRunsResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const query = params.size > 0 ? `?${params}` : '';
  return request(`/api/runs${query}`, listRunsResponseSchema, { signal });
}

export async function fetchRun(id: string, signal?: AbortSignal): Promise<WorkflowRun> {
  const { run } = await request(`/api/runs/${encodeURIComponent(id)}`, runResponseSchema, { signal });
  return run;
}

export async function retryRun(action: RetryAction): Promise<WorkflowRun> {
  const { run } = await request(`/api/runs/${encodeURIComponent(action.runId)}/retry`, runResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  return run;
}
