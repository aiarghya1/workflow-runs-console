import type { WorkflowRun } from '@app/shared';
import { pino } from 'pino';
import { loadConfig, type Config } from '../src/config';

export const silentLogger = () => pino({ level: 'silent' });

export const testConfig = (overrides: Record<string, string> = {}): Config =>
  loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    PORT: '0',
    RETRY_FAILURE_RATE: '0',
    STEP_DURATION_MS: '10',
    ...overrides,
  });

export const makeRun = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: 'run-1',
  workflowName: 'contract-review',
  status: 'failed',
  startedAt: '2026-04-09T08:00:00Z',
  latencyMs: 1000,
  tokenCount: 500,
  retries: 0,
  errorMessage: 'LLM provider timeout during generate step',
  steps: [
    { name: 'ingest', status: 'success' },
    { name: 'retrieve', status: 'success' },
    { name: 'generate', status: 'failed', errorMessage: 'LLM provider timeout' },
    { name: 'review', status: 'pending' },
  ],
  ...overrides,
});

export const REQUEST_ID = '7b0f2a7e-6a0e-4d5b-9a51-0b1f8a3c2d11';
export const OTHER_REQUEST_ID = '0d4c9d62-5b0b-4e36-9b3a-8a6f1c9e7f22';
