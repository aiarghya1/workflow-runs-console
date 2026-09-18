# Workflow Runs Console

An internal tool for AI operations. Operators can list workflow runs, filter them, inspect each run's steps, and **safely** retry failed runs, either the whole run or only the failed step.

The brief is in [CHALLENGE.md](CHALLENGE.md). The original pack notes are in [CANDIDATE_PACK.md](CANDIDATE_PACK.md).

## Quick start

Requires Node 20+.

```bash
npm install
npm run dev            # API on :4000, UI on http://localhost:5173 (Vite proxies /api to the API)
```

| Command | What it does |
|---|---|
| `npm run typecheck` | Strict TypeScript check of every package and the E2E suite |
| `npm test` | Unit and integration tests (shared, backend, frontend) |
| `npm run test:coverage` | Same tests, fails if any package is below 100% lines/branches/functions/statements |
| `npm run test:e2e` | Playwright against the real API and a production build of the UI (first run: `npx playwright install chromium`) |
| `npm run test:all` | All of the above |
| `npm run build` | Bundles the API (`backend/dist`) and UI (`frontend/dist`) |

Backend configuration uses env vars. Each one is validated at startup, and the server refuses to boot on bad values:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `4000` / `127.0.0.1` | Listen address |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `RETRY_FAILURE_RATE` | `0.25` | Chance that each simulated step fails during a retry (`0` makes it deterministic) |
| `STEP_DURATION_MS` | `1500` | Simulated duration of each step |
| `IDEMPOTENCY_TTL_MS` / `IDEMPOTENCY_MAX_ENTRIES` | 10 min / 1000 | Bounds on the idempotency key store |
| `RETRY_RATE_LIMIT_PER_MINUTE` | `30` | Per-IP limit on retry requests |
| `LOG_LEVEL` | `info` | pino log level |

## Architecture

```
shared/     zod schemas that mirror shared/contracts/*.json. Single source of truth for types + runtime validation
backend/    Express 5 API
  routes/        HTTP only: parse and validate input, call the service, shape the response
  services/      RunService (business rules, retry safety) · RunExecutor (simulated workflow engine)
  repositories/  RunRepository: in-memory Map seeded from fixtures/, returns defensive copies
  lib/           IdempotencyStore (TTL + size-bounded), errors, logger
  middleware/    validation helper, error handler (safe messages, generic 500)
frontend/   React 19 + TanStack Query
  api/           fetch wrapper (timeout, typed errors, response validation) + endpoint functions
  hooks/         useRuns / useRun (polling) / useRetryRun (duplicate guard) / useDebouncedValue
  components/    RunsTable, RunFilters, RunDetails, StepList, RetryPanel, StatusBadge, Feedback states
  pages/         RunsPage (list/details layout, filter state)
e2e/        Playwright specs
```

### API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/runs?status=&search=` | Summaries without steps, newest first. `status` must be one of the enum values; `search` is trimmed, max 100 chars, case-insensitive |
| GET | `/api/runs/:id` | Full run with steps. `id` must match `^[A-Za-z0-9_-]{1,64}$` |
| POST | `/api/runs/:id/retry` | Body follows `retry-action.schema.json`: `{ runId, mode: "full_run" \| "failed_step", stepName?, requestId? }`. Returns `202 { run }` |
| GET | `/health` | Liveness |

Errors always use the shape `{ error: { code, message, details? } }`. Codes include `VALIDATION_ERROR`, `NOT_FOUND`, `RUN_NOT_RETRYABLE`, `STEP_NOT_RETRYABLE`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE` and `INTERNAL_ERROR`.

### Data flow

1. `RunsPage` holds the filter state. Search is debounced by 300 ms, then `useRuns(filters)` calls `GET /api/runs`. While a new filter loads, the previous results stay on screen instead of a spinner.
2. Clicking a row sets `selectedId`, and `<RunDetails key={id}>` calls `useRun(id)` to fetch `GET /api/runs/:id`.
3. Retry: `useRetryRun` sends the POST, puts the returned `running` run straight into the cache, and invalidates the list. `useRun` polls every second while the run is `running`, and stops once it reaches `success` or `failed`. The list polls the same way while any visible run is running.
4. On the server, `RunExecutor` advances one step per `STEP_DURATION_MS`. This stands in for a real queue or worker.

### State management

Server state lives only in TanStack Query: caching, loading and error flags, polling and invalidation. UI state (filters, selection) is local `useState`. There's no global store because nothing needs one.

## Retry safety

Duplicate retries are blocked at four layers:

1. **UI:** both retry buttons are disabled while a request is in flight.
2. **Hook:** a synchronous `useRef` guard drops extra clicks that arrive before React re-renders. E2E sends 5 clicks with no delay and checks exactly 1 POST goes out.
3. **Idempotency key:** each retry sends a `requestId` (UUID). The server stores the result for 10 minutes, so a repeated key replays the original `202` (`Idempotent-Replayed: true`) instead of retrying again. The same key with a different payload gets `422`. After a *network* error the client reuses the key, because the server may already have applied the retry. After a definite server answer it creates a new key.
4. **State guard:** only a `failed` run can be retried. It moves to `running` in the same synchronous call, so a concurrent retry with a *different* key gets `409`. `RunService.retryRun` never awaits, so on Node's single thread no other request can interleave between the check and the write.

The client never auto-retries mutations (`mutations.retry: false`). Queries retry only on network errors or 5xx, at most twice.

## Security and performance

- **Input:** every query, param and body is validated with strict zod schemas. Unknown keys are rejected, and so are repeated query params. Bodies are JSON-only and capped at 10 KB. Seed data is also validated at boot.
- **Output:** the UI validates every API response against the same schemas. React escaping only, with no `dangerouslySetInnerHTML`.
- **Transport and headers:** helmet (CSP, nosniff, frame options, etc.), `x-powered-by` removed, CORS limited to configured origins, per-IP rate limit on retries.
- **Errors:** unknown errors are logged with their request ID and returned as a generic 500, so stack traces and internal messages never leak.
- **Logs:** structured pino logs with request ID, method, URL and status only. No headers or bodies. `Authorization` and cookies are redacted anyway. An incoming `X-Request-Id` is reused only if it's well-formed.
- **Memory:** the idempotency store has a TTL and an entry cap. Repository reads and writes are deep copies, so callers can't mutate stored state. Executor timers are `unref`'d and cleared on shutdown (SIGINT/SIGTERM).
- **Performance:** filtering happens on the server, the list returns summaries without steps, search is debounced, polling runs only while something is running, and fetches time out after 10 s. `RunsTable` is memoized.

## Testing

| Layer | Tools | What it covers |
|---|---|---|
| Unit | Vitest | Schemas, config, idempotency store, repository, executor (fake timers), service rules, error handler; API client, formatters, query-retry policy, hooks, components |
| Integration | Vitest + Supertest; RTL + MSW | Full Express app over HTTP (validation, CORS, headers, rate limit, concurrency, logging, real server start/stop); whole React app against a stateful mock API |
| E2E | Playwright | Real API + production UI build: list, filter, search, details, full retry to success, 5-click duplicate guard, failed-step retry, error and recovery, API hardening |

Unit and integration coverage is enforced at **100%** (lines, branches, functions, statements) in every package. Two files are excluded, each only a few lines of startup wiring: `backend/src/index.ts` (signal handling) and `frontend/src/main.tsx` (DOM mount). The code they call, `startServer` and `App`, is fully tested. E2E is measured by user flows rather than line coverage.

## Trade-offs and what I skipped

- **In-memory only.** State resets on restart, and a single process is assumed. The atomic check-and-set in `retryRun` relies on Node's single thread.
- **Simulated execution.** `RunExecutor` is a timer, not a real worker. Fixture run `run-1003` stays `running` because nothing is executing it.
- **Polling instead of push.** 1 s polling is simple and robust at this scale.
- **No auth, pagination or URL-synced filters.** Not required by the brief.
- **`npm audit`:** one low-severity esbuild advisory, only affecting the Windows dev server, pulled in by build tooling. It doesn't ship in the runtime bundle.

## Production next steps

- Move runs and idempotency keys to a database or Redis, and enforce retry safety there: a conditional update `WHERE status = 'failed'` or a row version, plus a unique idempotency-key constraint.
- Put retries on a real queue with a worker, with backoff and a per-run retry cap.
- Add authentication and authorization (who may retry what), plus an audit log of retries including operator identity.
- Replace polling with SSE or WebSockets. Add pagination and URL-synced filters.
- Add metrics (retry rate, failure rate per step, latency), tracing via OpenTelemetry, and alerting.

## Where AI helped, and where it was risky

- **Helped:** scaffolding the monorepo and configs, turning the JSON Schemas into zod, generating the test matrix, writing the MSW mock and Playwright specs, and drafting the CSS.
- **Checked by hand:** the retry state machine and idempotency semantics (replay vs. conflict vs. key reuse), whether key reuse after network errors is correct, that coverage exclusions are honest, and the real UI (desktop and mobile screenshots) and real server logs.
- **Risky:** AI tends to invent APIs for fast-moving libraries (Vite 8, Vitest 5, zod 4, Express 5), write tests that pass vacuously (for example, a mock that didn't sort the list the way the real API does), and add scope. Every claim here is backed by a test that runs against real code.
