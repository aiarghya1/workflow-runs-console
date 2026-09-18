import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { createLogger } from '../../src/lib/logger';

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 4000,
      CORS_ORIGIN: ['http://localhost:5173'],
      RETRY_FAILURE_RATE: 0.25,
    });
  });

  it('coerces numbers and splits multiple CORS origins', () => {
    const config = loadConfig({ PORT: '8080', CORS_ORIGIN: 'http://a.test, http://b.test,' });
    expect(config.PORT).toBe(8080);
    expect(config.CORS_ORIGIN).toEqual(['http://a.test', 'http://b.test']);
  });

  it('fails fast with a readable message on invalid values', () => {
    expect(() => loadConfig({ PORT: 'abc', RETRY_FAILURE_RATE: '2' })).toThrow(
      /Invalid configuration: PORT: .*; RETRY_FAILURE_RATE: /,
    );
  });
});

describe('createLogger', () => {
  it('uses the configured level', () => {
    expect(createLogger({ LOG_LEVEL: 'warn' }).level).toBe('warn');
  });
});
