import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '../../src/api/client';
import { formatDateTime, formatLatency, formatNumber } from '../../src/lib/format';
import { createQueryClient, shouldRetryQuery } from '../../src/lib/queryClient';

describe('format', () => {
  it('formats numbers with grouping', () => {
    expect(formatNumber(18234)).toBe('18,234');
  });

  it('formats latency in ms below a second and seconds above', () => {
    expect(formatLatency(850)).toBe('850 ms');
    expect(formatLatency(14520)).toBe('14.5 s');
  });

  it('formats timestamps in UTC regardless of local time zone', () => {
    expect(formatDateTime('2026-04-09T08:00:00Z')).toBe('Apr 9, 2026, 8:00 AM UTC');
  });
});

describe('query client', () => {
  it('does not retry client errors', () => {
    expect(shouldRetryQuery(0, new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
  });

  it('retries transient failures a bounded number of times', () => {
    expect(shouldRetryQuery(0, new ApiError(503, 'HTTP_ERROR', 'x'))).toBe(true);
    expect(shouldRetryQuery(1, new NetworkError())).toBe(true);
    expect(shouldRetryQuery(2, new NetworkError())).toBe(false);
  });

  it('never auto-retries mutations', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
