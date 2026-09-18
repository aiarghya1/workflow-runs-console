import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Config } from './config';
import { AppError } from './lib/errors';
import type { Logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createRunsRouter } from './routes/runs';
import type { RunService } from './services/runService';

export type AppDeps = {
  config: Pick<Config, 'CORS_ORIGIN' | 'RETRY_RATE_LIMIT_PER_MINUTE'>;
  logger: Logger;
  runService: RunService;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function createApp({ config, logger, runService }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, methods: ['GET', 'POST'] }));
  app.use(
    pinoHttp({
      logger,
      // Reuse a caller-supplied correlation id only if it is well-formed; otherwise mint one.
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  const retryLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.RETRY_RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many retry requests, slow down')),
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/runs', createRunsRouter(runService, retryLimiter));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
