import type { StepStatus } from '@app/shared';

export function StatusBadge({ status }: { status: StepStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {status}
    </span>
  );
}
