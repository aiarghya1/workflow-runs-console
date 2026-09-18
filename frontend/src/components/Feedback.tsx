import { getErrorMessage } from '../api/client';

export function LoadingState({ label }: { label: string }) {
  return (
    <p className="feedback" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="feedback feedback--error" role="alert">
      <p>{getErrorMessage(error)}</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="feedback">{message}</p>;
}
