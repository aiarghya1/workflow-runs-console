import { useRun } from '../hooks/useRuns';
import { formatDateTime, formatLatency, formatNumber } from '../lib/format';
import { ErrorState, LoadingState } from './Feedback';
import { AlertIcon, CloseIcon } from './Icons';
import { RetryPanel } from './RetryPanel';
import { StatusBadge } from './StatusBadge';
import { StepList } from './StepList';

export function RunDetails({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: run, isPending, error, refetch } = useRun(runId);

  return (
    <aside className="details card" aria-label={`Run ${runId} details`}>
      <header className="details__header">
        <h2 className="details__id">{runId}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
          <CloseIcon />
        </button>
      </header>

      {isPending && <LoadingState label="Loading run…" />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {run && (
        <>
          <div className="details__title">
            <span className="details__workflow">{run.workflowName}</span>
            <StatusBadge status={run.status} />
          </div>

          <dl className="metrics">
            <div className="metric metric--wide">
              <dt>Started</dt>
              <dd>{formatDateTime(run.startedAt)}</dd>
            </div>
            <div className="metric">
              <dt>Latency</dt>
              <dd>{formatLatency(run.latencyMs)}</dd>
            </div>
            <div className="metric">
              <dt>Tokens</dt>
              <dd>{formatNumber(run.tokenCount)}</dd>
            </div>
            <div className="metric">
              <dt>Retries</dt>
              <dd>{run.retries}</dd>
            </div>
          </dl>

          {run.errorMessage && (
            <p className="callout callout--error" role="note">
              <AlertIcon />
              <span>{run.errorMessage}</span>
            </p>
          )}

          {/* Primary action sits right under the error it resolves, above the fold. */}
          <RetryPanel run={run} />

          <h3 className="section-title">Steps</h3>
          <StepList steps={run.steps} />
        </>
      )}
    </aside>
  );
}
