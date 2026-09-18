import type { WorkflowRun } from '@app/shared';
import { getErrorMessage } from '../api/client';
import { useRetryRun } from '../hooks/useRuns';
import { AlertIcon, RetryIcon } from './Icons';

export function RetryPanel({ run }: { run: WorkflowRun }) {
  const { retry, isPending, isSuccess, error } = useRetryRun();
  const failedStep = run.steps.find((step) => step.status === 'failed');
  const canRetry = run.status === 'failed';

  return (
    <section className="retry" aria-label="Retry">
      {canRetry && (
        <div className="retry__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={isPending}
            onClick={() => retry({ runId: run.id, mode: 'full_run' })}
          >
            {isPending ? <span className="spinner spinner--light" aria-hidden="true" /> : <RetryIcon />}
            {isPending ? 'Retrying…' : 'Retry'}
          </button>
          {failedStep && (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={isPending}
              onClick={() => retry({ runId: run.id, mode: 'failed_step', stepName: failedStep.name })}
            >
              Retry {failedStep.name} step only
            </button>
          )}
        </div>
      )}
      <div aria-live="polite">
        {isSuccess && (
          <p className="callout callout--success" role="status">
            Retry started. Progress updates automatically.
          </p>
        )}
      </div>
      {error && (
        <p className="callout callout--error" role="alert">
          <AlertIcon />
          <span>Retry failed: {getErrorMessage(error)}</span>
        </p>
      )}
    </section>
  );
}
