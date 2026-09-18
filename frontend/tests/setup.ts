import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { db } from './msw/handlers';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => db.reset());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
