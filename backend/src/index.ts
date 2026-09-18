import { loadConfig } from './config';
import { startServer } from './server';

const { logger, close } = await startServer(loadConfig());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    void close().then(() => process.exit(0));
  });
}
