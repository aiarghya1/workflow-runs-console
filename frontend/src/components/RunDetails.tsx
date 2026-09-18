import { useRun } from '../hooks/useRuns';
import { formatDateTime, formatLatency, formatNumber } from '../lib/format';
import { ErrorState, LoadingState } from './Feedback';
import { RetryPanel } from './RetryPanel';
import { StatusBadge } from './StatusBadge';
import { StepList } from './StepList';

export function RunDetails({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: run, isPending, error, refetch } = useRun(runId);

  return (
    <aside className="details" aria-label={`Run ${runId} details`}>
      <header className="details__header">
        <h2>{runId}</h2>
        <button type="button" className="secondary" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </header>

      {isPending && <LoadingState label="Loading run…" />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {run && (
        <>
          <dl className="details__meta">
            <dt>Workflow</dt>
            <dd>{run.workflowName}</dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={run.status} />
            </dd>
            <dt>Started</dt>
            <dd>{formatDateTime(run.startedAt)}</dd>
            <dt>Latency</dt>
            <dd>{formatLatency(run.latencyMs)}</dd>
            <dt>Tokens</dt>
            <dd>{formatNumber(run.tokenCount)}</dd>
            <dt>Retries</dt>
            <dd>{run.retries}</dd>
          </dl>
          {run.errorMessage && (
            <p className="details__error" role="note">
              {run.errorMessage}
            </p>
          )}
          <h3>Steps</h3>
          <StepList steps={run.steps} />
          <RetryPanel run={run} />
        </>
      )}
    </aside>
  );
}
