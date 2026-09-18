import type { WorkflowRun } from '@app/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

export const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

export function renderWithClient(ui: ReactElement, options?: RenderOptions) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper, ...options }) };
}

export const makeRun = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 'run-1',
  workflowName: 'contract-review',
  status: 'failed',
  startedAt: '2026-04-09T08:00:00Z',
  latencyMs: 14520,
  tokenCount: 18234,
  retries: 1,
  errorMessage: 'LLM provider timeout during generate step',
  steps: [
    { name: 'ingest', status: 'success' },
    { name: 'retrieve', status: 'success' },
    { name: 'generate', status: 'failed', errorMessage: 'LLM provider timeout' },
    { name: 'review', status: 'pending' },
  ],
  ...overrides,
});
