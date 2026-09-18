import { loadConfig } from './config';
import { createLogger } from './lib/logger';
import { startServer } from './server';

const config = loadConfig();
const logger = createLogger(config);

try {
  const { close } = await startServer(config, logger);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      logger.info({ signal }, 'shutting down');
      void close().then(() => process.exit(0));
    });
  }
} catch (error) {
  logger.fatal({ err: error }, 'server failed to start');
  process.exitCode = 1;
}
