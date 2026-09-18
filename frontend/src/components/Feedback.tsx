import { getErrorMessage } from '../api/client';
import { AlertIcon } from './Icons';

export function LoadingState({ label }: { label: string }) {
  return (
    <p className="feedback feedback--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="callout callout--error" role="alert">
      <AlertIcon />
      <p>{getErrorMessage(error)}</p>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="feedback feedback--empty">{message}</p>;
}
