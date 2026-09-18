import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { workflowRunSchema } from '@app/shared';
import { z } from 'zod';
import seedData from '../../fixtures/workflow-runs.json' with { type: 'json' };
import { createApp } from './app';
import type { Config } from './config';
import { IdempotencyStore } from './lib/idempotencyStore';
import { createLogger, type Logger } from './lib/logger';
import { RunRepository } from './repositories/runRepository';
import { RunExecutor } from './services/runExecutor';
import { RunService, type RetryRecord } from './services/runService';

export type RunningServer = { server: Server; url: string; logger: Logger; close: () => Promise<void> };

/** Wires dependencies together. Seed data is validated so a bad fixture fails at boot, not at request time. */
export function buildContainer(config: Config, logger: Logger = createLogger(config)) {
  const seed = z.array(workflowRunSchema).parse(seedData);
  const repository = new RunRepository(seed);
  const executor = new RunExecutor({
    repository,
    logger,
    stepDurationMs: config.STEP_DURATION_MS,
    failureRate: config.RETRY_FAILURE_RATE,
  });
  const idempotency = new IdempotencyStore<RetryRecord>({
    ttlMs: config.IDEMPOTENCY_TTL_MS,
    maxEntries: config.IDEMPOTENCY_MAX_ENTRIES,
  });
  const runService = new RunService({ repository, executor, idempotency, logger });
  const app = createApp({ config, logger, runService });
  return { app, executor, logger };
}

/**
 * Resolves once the server is listening; rejects (EADDRINUSE, EACCES, bad host, ...) if it cannot start,
 * so callers get a controlled startup failure instead of an unhandled error.
 */
export function startServer(config: Config, logger?: Logger): Promise<RunningServer> {
  const container = buildContainer(config, logger);
  const server = createServer(container.app);
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      container.executor.stop();
      reject(error);
    };
    server.once('error', onError);
    server.listen(config.PORT, config.HOST, () => {
      server.off('error', onError);
      const { port } = server.address() as AddressInfo;
      const url = `http://${config.HOST}:${port}`;
      container.logger.info({ url }, 'server listening');
      const close = () =>
        new Promise<void>((done) => {
          container.executor.stop();
          server.close(() => done());
          server.closeIdleConnections();
        });
      resolve({ server, url, logger: container.logger, close });
    });
  });
}
