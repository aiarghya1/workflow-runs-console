import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, getErrorMessage, NetworkError, request } from '../../src/api/client';
import { fetchRun, fetchRuns, retryRun } from '../../src/api/runs';
import { db } from '../msw/handlers';
import { server } from '../msw/server';

const REQUEST_ID = '7b0f2a7e-6a0e-4d5b-9a51-0b1f8a3c2d11';

describe('request', () => {
  const schema = z.object({ ok: z.boolean() });

  it('returns validated data and sends JSON accept headers', async () => {
    let accept: string | null = null;
    server.use(
      http.get('*/ping', ({ request: req }) => {
        accept = req.headers.get('accept');
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(request('/ping', schema)).resolves.toEqual({ ok: true });
    expect(accept).toBe('application/json');
  });

  it('maps an API error envelope to ApiError', async () => {
    server.use(http.get('*/ping', () => HttpResponse.json({ error: { code: 'NOPE', message: 'No way' } }, { status: 409 })));
    await expect(request('/ping', schema)).rejects.toMatchObject({ name: 'ApiError', status: 409, code: 'NOPE', message: 'No way' });
  });

  it('handles error responses without a JSON body', async () => {
    server.use(http.get('*/ping', () => new HttpResponse('Bad gateway', { status: 502 })));
    await expect(request('/ping', schema)).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR', message: 'Request failed with status 502' });
  });

  it('rejects successful responses that break the contract', async () => {
    server.use(http.get('*/ping', () => HttpResponse.json({ ok: 'yes' })));
    await expect(request('/ping', schema)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('maps connection failures to NetworkError', async () => {
    server.use(http.get('*/ping', () => HttpResponse.error()));
    await expect(request('/ping', schema)).rejects.toBeInstanceOf(NetworkError);
  });

  it('honours a caller abort signal', async () => {
    server.use(http.get('*/ping', () => HttpResponse.json({ ok: true })));
    const controller = new AbortController();
    controller.abort();
    await expect(request('/ping', schema, { signal: controller.signal })).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('getErrorMessage', () => {
  it('exposes messages from known errors only', () => {
    expect(getErrorMessage(new ApiError(409, 'X', 'Conflict here'))).toBe('Conflict here');
    expect(getErrorMessage(new NetworkError())).toMatch(/Could not reach the server/);
    expect(getErrorMessage(new Error('internal detail'))).toBe('Something went wrong');
  });
});

describe('runs api', () => {
  it('fetchRuns sends only the filters that are set', async () => {
    const urls: string[] = [];
    server.events.on('request:start', ({ request: req }) => void urls.push(new URL(req.url).search));
    await fetchRuns({});
    await fetchRuns({ status: 'failed', search: 'legal qa' });
    server.events.removeAllListeners();
    expect(urls).toEqual(['', '?status=failed&search=legal+qa']);
  });

  it('fetchRun returns the run and url-encodes the id', async () => {
    let path = '';
    server.events.on('request:start', ({ request: req }) => void (path = new URL(req.url).pathname));
    await expect(fetchRun('run-1001')).resolves.toMatchObject({ id: 'run-1001' });
    await expect(fetchRun('a/b')).rejects.toBeInstanceOf(ApiError);
    server.events.removeAllListeners();
    expect(path).toBe('/api/runs/a%2Fb');
  });

  it('retryRun posts the action as JSON and returns the updated run', async () => {
    const run = await retryRun({ runId: 'run-1001', mode: 'full_run', requestId: REQUEST_ID });
    expect(run).toMatchObject({ id: 'run-1001', status: 'running', retries: 2 });
    expect(db.retryRequests).toEqual([{ runId: 'run-1001', mode: 'full_run', requestId: REQUEST_ID }]);
  });
});
