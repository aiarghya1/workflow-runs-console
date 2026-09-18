import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../../src/api/client';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { runKeys, useRetryRun } from '../../src/hooks/useRuns';
import { db } from '../msw/handlers';
import { server } from '../msw/server';
import { createTestQueryClient } from '../utils';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());

  it('only emits the latest value after the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});

describe('useRetryRun', () => {
  const setup = () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, ...renderHook(() => useRetryRun(), { wrapper }) };
  };

  it('sends one request when retry is called repeatedly in the same tick', async () => {
    const { result, queryClient } = setup();
    act(() => {
      result.current.retry({ runId: 'run-1001', mode: 'full_run' });
      result.current.retry({ runId: 'run-1001', mode: 'full_run' });
      result.current.retry({ runId: 'run-1001', mode: 'full_run' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(db.retryRequests).toHaveLength(1);
    expect(db.retryRequests[0]!.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(queryClient.getQueryData(runKeys.detail('run-1001'))).toMatchObject({ status: 'running' });
  });

  it('reuses the idempotency key after a network error, and mints a new one otherwise', async () => {
    server.use(http.post('*/api/runs/:id/retry', () => HttpResponse.error(), { once: true }));
    const keys: string[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST') keys.push(((await request.clone().json()) as { requestId: string }).requestId);
    });
    const { result } = setup();

    act(() => result.current.retry({ runId: 'run-1001', mode: 'full_run' }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(NetworkError));

    act(() => result.current.retry({ runId: 'run-1001', mode: 'full_run' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => result.current.retry({ runId: 'run-1001', mode: 'full_run' }));
    await waitFor(() => expect(result.current.error).toMatchObject({ code: 'RUN_NOT_RETRYABLE' }));
    server.events.removeAllListeners();

    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('does not reuse a network-failed key for a different action', async () => {
    server.use(http.post('*/api/runs/:id/retry', () => HttpResponse.error(), { once: true }));
    const { result } = setup();

    act(() => result.current.retry({ runId: 'run-1001', mode: 'full_run' }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(NetworkError));
    act(() => result.current.retry({ runId: 'run-1001', mode: 'failed_step', stepName: 'generate' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(db.retryRequests).toHaveLength(1);
    expect(db.retryRequests[0]).toMatchObject({ mode: 'failed_step', stepName: 'generate' });
  });
});
