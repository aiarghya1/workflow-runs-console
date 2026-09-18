import { describe, expect, it } from 'vitest';
import { startServer } from '../../src/server';
import { testConfig } from '../helpers';

describe('startServer', () => {
  it('listens on a real port, serves requests and shuts down cleanly', async () => {
    const running = await startServer(testConfig());
    expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const res = await fetch(`${running.url}/api/runs/run-1001`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { run: { id: string } }).run.id).toBe('run-1001');

    await running.close();
    expect(running.server.listening).toBe(false);
  });
});
