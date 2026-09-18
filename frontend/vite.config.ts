import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin /api in the browser; Vite forwards to the backend, so no CORS in dev.
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  preview: { port: 5173, strictPort: true, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  build: { sourcemap: true },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts <App /> into the DOM; App itself is fully tested.
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
