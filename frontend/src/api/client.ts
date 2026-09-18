import { errorResponseSchema } from '@app/shared';
import type { ZodType } from 'zod';

export const REQUEST_TIMEOUT_MS = 10_000;

/** The server answered with an error; `code` is the machine-readable reason from the API. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never got a response (offline, timeout, server down). Outcome on the server is unknown. */
export class NetworkError extends Error {
  constructor() {
    super('Could not reach the server. Check your connection and try again.');
    this.name = 'NetworkError';
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof NetworkError ? error.message : 'Something went wrong';
}

/**
 * fetch wrapper that: applies a timeout, maps failures to typed errors, and validates every
 * successful response against the shared contract so bad data never reaches the UI.
 */
export async function request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}): Promise<T> {
  const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...(init.signal ? [init.signal] : [])];
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: AbortSignal.any(signals),
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new NetworkError();
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(response.status, 'HTTP_ERROR', `Request failed with status ${response.status}`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(response.status, 'INVALID_RESPONSE', 'Received an unexpected response from the server');
  return parsed.data;
}
