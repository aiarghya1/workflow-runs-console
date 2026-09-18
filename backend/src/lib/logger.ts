import { pino, type Logger } from 'pino';
import type { Config } from '../config';

export type { Logger };

export function createLogger(config: Pick<Config, 'LOG_LEVEL'>): Logger {
  return pino({
    level: config.LOG_LEVEL,
    // Never log credentials or cookies even if a client sends them.
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
}
