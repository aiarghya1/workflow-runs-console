import { defineConfig, devices } from '@playwright/test';

// Dedicated ports so E2E never collides with a local `npm run dev`.
const API_PORT = 4100;
const WEB_PORT = 5174;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  // Specs share one in-memory backend, so they run serially in a fixed order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: WEB_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx backend/src/index.ts',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        CORS_ORIGIN: WEB_URL,
        LOG_LEVEL: 'warn',
        RETRY_FAILURE_RATE: '0',
        STEP_DURATION_MS: '250',
      },
    },
    {
      // Production build served by `vite preview`, proxying /api to the backend above.
      command: `npm run build -w frontend && npm run preview -w frontend -- --port ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
