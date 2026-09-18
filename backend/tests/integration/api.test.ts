import { listRunsResponseSchema, runResponseSchema } from '@app/shared';
import { pino } from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { buildContainer } from '../../src/server';
import { OTHER_REQUEST_ID, REQUEST_ID, silentLogger, testConfig } from '../helpers';

let stopExecutor: (() => void) | undefined;

const createTestApp = (overrides: Record<string, string> = {}) => {
  const { app, executor } = buildContainer(testConfig(overrides), silentLogger());
  stopExecutor = () => executor.stop();
  return app;
};

afterEach(() => stopExecutor?.());

const until = async (check: () => Promise<boolean>, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('GET /health', () => {
  it('reports ok with security headers and a request id', async () => {
    const res = await request(createTestApp()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('propagates a well-formed caller request id and replaces a malicious one', async () => {
    const app = createTestApp();
    const good = await request(app).get('/health').set('X-Request-Id', 'abc-123');
    expect(good.headers['x-request-id']).toBe('abc-123');
    const bad = await request(app).get('/health').set('X-Request-Id', '<script>alert(1)</script>');
    expect(bad.headers['x-request-id']).not.toContain('<');
  });
});

describe('request logging', () => {
  it('logs lean request lines (no headers) and skips health checks', async () => {
    const lines: Record<string, unknown>[] = [];
    const logger = pino({ level: 'info' }, { write: (line: string) => void lines.push(JSON.parse(line)) });
    const { app, executor } = buildContainer(testConfig(), logger);
    stopExecutor = () => executor.stop();

    await request(app).get('/health').set('Authorization', 'Bearer secret');
    await request(app).get('/api/runs/run-1001').set('Authorization', 'Bearer secret');

    const requestLogs = lines.filter((line) => line.msg === 'request completed');
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0]).toMatchObject({
      req: { method: 'GET', url: '/api/runs/run-1001', id: expect.any(String) },
      res: { statusCode: 200 },
    });
    expect(JSON.stringify(lines)).not.toContain('secret');
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin only', async () => {
    const app = createTestApp();
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await request(app).get('/health').set('Origin', 'http://evil.test');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('GET /api/runs', () => {
  it('lists all fixture runs as contract-valid summaries, newest first', async () => {
    const res = await request(createTestApp()).get('/api/runs').expect(200);
    const body = listRunsResponseSchema.parse(res.body);
    expect(body.total).toBe(6);
    expect(body.items[0]!.id).toBe('run-1006');
    expect(body.items[0]).not.toHaveProperty('steps');
  });

  it('filters by status', async () => {
    const res = await request(createTestApp()).get('/api/runs?status=failed').expect(200);
    expect(res.body.items.map((run: { id: string }) => run.id)).toEqual(['run-1006', 'run-1004', 'run-1001']);
  });

  it('searches by workflowName and combines with status', async () => {
    const app = createTestApp();
    const search = await request(app).get('/api/runs').query({ search: '  LEGAL ' }).expect(200);
    expect(search.body.items.map((run: { id: string }) => run.id)).toEqual(['run-1005']);
    const combined = await request(app).get('/api/runs').query({ search: 'review', status: 'success' }).expect(200);
    expect(combined.body).toEqual({ items: [], total: 0 });
  });

  it.each([
    ['unknown status', { status: 'queued' }],
    ['search too long', { search: 'x'.repeat(101) }],
    ['unknown parameter', { sort: 'asc' }],
    ['repeated parameter', 'status=failed&status=success'],
  ])('rejects %s with 400', async (_label, query) => {
    const res = await request(createTestApp()).get('/api/runs').query(query).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('GET /api/runs/:id', () => {
  it('returns full run details including steps', async () => {
    const res = await request(createTestApp()).get('/api/runs/run-1001').expect(200);
    const { run } = runResponseSchema.parse(res.body);
    expect(run.steps.map((step) => step.name)).toEqual(['ingest', 'retrieve', 'generate', 'review']);
    expect(run.steps[2]).toEqual({ name: 'generate', status: 'failed', errorMessage: 'LLM provider timeout' });
  });

  it('404s for an unknown run', async () => {
    const res = await request(createTestApp()).get('/api/runs/run-9999').expect(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Run run-9999 not found' });
  });

  it('400s for an id with unsafe characters', async () => {
    await request(createTestApp()).get('/api/runs/run%3Balert(1)').expect(400);
  });
});

describe('POST /api/runs/:id/retry', () => {
  const retry = (app: ReturnType<typeof createTestApp>, id: string, body: object) =>
    request(app).post(`/api/runs/${id}/retry`).send(body);

  it('accepts a full retry and drives the run to success', async () => {
    const app = createTestApp();
    const res = await retry(app, 'run-1001', { runId: 'run-1001', mode: 'full_run', requestId: REQUEST_ID }).expect(202);
    expect(res.headers['idempotent-replayed']).toBe('false');
    const { run } = runResponseSchema.parse(res.body);
    expect(run).toMatchObject({ status: 'running', retries: 2 });

    await until(async () => (await request(app).get('/api/runs/run-1001')).body.run.status === 'success');
    const list = await request(app).get('/api/runs?status=failed');
    expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain('run-1001');
  });

  it('retries only the failed step', async () => {
    const app = createTestApp();
    const body = { runId: 'run-1004', mode: 'failed_step', stepName: 'retrieve' };
    const res = await retry(app, 'run-1004', body).expect(202);
    expect(res.body.run.steps.map((step: { status: string }) => step.status)).toEqual([
      'success',
      'running',
      'pending',
      'pending',
    ]);
  });

  it('reports a failed retry as a failed run when the simulated step fails', async () => {
    const app = createTestApp({ RETRY_FAILURE_RATE: '1' });
    await retry(app, 'run-1006', { runId: 'run-1006', mode: 'full_run' }).expect(202);
    await until(async () => (await request(app).get('/api/runs/run-1006')).body.run.status === 'failed');
    const { body } = await request(app).get('/api/runs/run-1006');
    expect(body.run).toMatchObject({ retries: 3, errorMessage: 'Document parser crashed during ingest step' });
  });

  it('prevents duplicate retries from rapid concurrent clicks', async () => {
    const app = createTestApp();
    const body = { runId: 'run-1001', mode: 'full_run', requestId: REQUEST_ID };
    const responses = await Promise.all([retry(app, 'run-1001', body), retry(app, 'run-1001', body), retry(app, 'run-1001', body)]);

    expect(responses.map((res) => res.status)).toEqual([202, 202, 202]);
    expect(responses.filter((res) => res.headers['idempotent-replayed'] === 'true')).toHaveLength(2);
    const { body: detail } = await request(app).get('/api/runs/run-1001');
    expect(detail.run.retries).toBe(2);
  });

  it('returns 409 for a second retry with a different key while the first is in progress', async () => {
    const app = createTestApp();
    await retry(app, 'run-1001', { runId: 'run-1001', mode: 'full_run', requestId: REQUEST_ID }).expect(202);
    const res = await retry(app, 'run-1001', { runId: 'run-1001', mode: 'full_run', requestId: OTHER_REQUEST_ID }).expect(409);
    expect(res.body.error.code).toBe('RUN_NOT_RETRYABLE');
  });

  it('returns 422 when a requestId is reused for a different retry', async () => {
    const app = createTestApp();
    await retry(app, 'run-1001', { runId: 'run-1001', mode: 'full_run', requestId: REQUEST_ID }).expect(202);
    const res = await retry(app, 'run-1001', {
      runId: 'run-1001',
      mode: 'failed_step',
      stepName: 'generate',
      requestId: REQUEST_ID,
    }).expect(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses to retry runs that are not failed', async () => {
    const res = await retry(createTestApp(), 'run-1002', { runId: 'run-1002', mode: 'full_run' }).expect(409);
    expect(res.body.error.message).toBe('Run run-1002 is success; only failed runs can be retried');
  });

  it.each([
    ['missing mode', { runId: 'run-1001' }],
    ['failed_step without stepName', { runId: 'run-1001', mode: 'failed_step' }],
    ['extra property', { runId: 'run-1001', mode: 'full_run', isAdmin: true }],
    ['non-uuid requestId', { runId: 'run-1001', mode: 'full_run', requestId: '1' }],
  ])('rejects invalid body (%s) with 400', async (_label, body) => {
    const res = await retry(createTestApp(), 'run-1001', body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a body runId that differs from the URL', async () => {
    await retry(createTestApp(), 'run-1001', { runId: 'run-1004', mode: 'full_run' }).expect(400);
  });

  it('404s for an unknown run', async () => {
    await retry(createTestApp(), 'run-0', { runId: 'run-0', mode: 'full_run' }).expect(404);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(createTestApp())
      .post('/api/runs/run-1001/retry')
      .set('Content-Type', 'application/json')
      .send('{"runId":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects oversized bodies', async () => {
    const res = await retry(createTestApp(), 'run-1001', { runId: 'run-1001', mode: 'full_run', pad: 'x'.repeat(20_000) }).expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects a non-JSON body as a validation error', async () => {
    await request(createTestApp()).post('/api/runs/run-1001/retry').type('text').send('retry please').expect(400);
  });

  it('rate limits retry requests', async () => {
    const app = createTestApp({ RETRY_RATE_LIMIT_PER_MINUTE: '2' });
    const body = { runId: 'run-1002', mode: 'full_run' };
    await retry(app, 'run-1002', body).expect(409);
    await retry(app, 'run-1002', body).expect(409);
    const res = await retry(app, 'run-1002', body).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(createTestApp()).delete('/api/runs/run-1001').expect(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Route DELETE /api/runs/run-1001 not found' });
  });
});
