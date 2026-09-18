import type { StepStatus } from '@app/shared';

export function StatusBadge({ status }: { status: StepStatus }) {
  return <span className={`badge badge--${status}`}>{status}</span>;
}
