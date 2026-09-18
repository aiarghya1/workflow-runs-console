import { expect, test } from '@playwright/test';

/** Retry-safety and hardening checks against the running backend (read-only or rejected calls only). */
const API = 'http://127.0.0.1:4100';

test('rejects retrying a run that is not failed', async ({ request }) => {
  const res = await request.post(`${API}/api/runs/run-1002/retry`, { data: { runId: 'run-1002', mode: 'full_run' } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe('RUN_NOT_RETRYABLE');
});

test('validates input and never leaks internals', async ({ request }) => {
  const bad = await request.post(`${API}/api/runs/run-1002/retry`, { data: { runId: 'run-1002', mode: 'failed_step' } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error.details[0].path).toBe('stepName');

  const query = await request.get(`${API}/api/runs?status=<script>`);
  expect(query.status()).toBe(400);
});

test('sends security headers', async ({ request }) => {
  const res = await request.get(`${API}/health`);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-powered-by']).toBeUndefined();
  expect(res.headers()['x-request-id']).toBeTruthy();
});
