import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

const MAX_QUERY_RETRIES = 2;

/** Retrying a 4xx will not change the answer; only transient failures (network, 5xx) are retried. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5_000, retry: shouldRetryQuery },
      // A retry POST is never auto-repeated by the client; the operator decides.
      mutations: { retry: false },
    },
  });
}
