import type { RetryAction, WorkflowRun } from '@app/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { NetworkError } from '../api/client';
import { fetchRun, fetchRuns, retryRun, type RunFilters } from '../api/runs';

export const POLL_INTERVAL_MS = 1_000;

export const runKeys = {
  all: ['runs'] as const,
  list: (filters: RunFilters) => ['runs', 'list', filters] as const,
  detail: (id: string) => ['runs', 'detail', id] as const,
};

const pollWhileRunning = (running: boolean) => (running ? POLL_INTERVAL_MS : false);

export function useRuns(filters: RunFilters) {
  return useQuery({
    queryKey: runKeys.list(filters),
    queryFn: ({ signal }) => fetchRuns(filters, signal),
    // Keep showing the previous results while a new filter loads, instead of flashing a spinner.
    placeholderData: keepPreviousData,
    refetchInterval: (query) => pollWhileRunning(!!query.state.data?.items.some((run) => run.status === 'running')),
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: runKeys.detail(id),
    queryFn: ({ signal }) => fetchRun(id, signal),
    refetchInterval: (query) => pollWhileRunning(query.state.data?.status === 'running'),
  });
}

export type RetryRequest = Omit<RetryAction, 'requestId'>;

/**
 * Client half of duplicate-retry protection:
 * - `inFlight` ref blocks a second submit synchronously, even before React re-renders the disabled button.
 * - The idempotency key is kept after a network error (the server may have applied the retry),
 *   so trying again for the same action is replayed server-side instead of retrying twice.
 */
export function useRetryRun() {
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const pendingKey = useRef<{ requestId: string; fingerprint: string } | null>(null);

  const mutation = useMutation({
    mutationFn: retryRun,
    onSuccess: (run: WorkflowRun) => queryClient.setQueryData(runKeys.detail(run.id), run),
    onSettled: () => queryClient.invalidateQueries({ queryKey: runKeys.all }),
  });
  const { mutate } = mutation;

  const retry = useCallback(
    (action: RetryRequest) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const fingerprint = JSON.stringify([action.runId, action.mode, action.stepName]);
      const requestId =
        pendingKey.current?.fingerprint === fingerprint ? pendingKey.current.requestId : crypto.randomUUID();
      pendingKey.current = { requestId, fingerprint };

      mutate(
        { ...action, requestId },
        {
          onSettled: (_run, error) => {
            inFlight.current = false;
            if (!(error instanceof NetworkError)) pendingKey.current = null;
          },
        },
      );
    },
    [mutate],
  );

  return { retry, isPending: mutation.isPending, isSuccess: mutation.isSuccess, error: mutation.error };
}
