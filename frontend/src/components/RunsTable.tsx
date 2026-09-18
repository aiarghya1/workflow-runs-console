import type { WorkflowRunSummary } from '@app/shared';
import { memo } from 'react';
import { formatDateTime, formatLatency, formatNumber } from '../lib/format';
import { StatusBadge } from './StatusBadge';

type Props = {
  runs: WorkflowRunSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Memoised: polling returns equal data often, and TanStack Query keeps references stable when it does. */
export const RunsTable = memo(function RunsTable({ runs, selectedId, onSelect }: Props) {
  return (
    <div className="table-scroll">
      <table className="runs-table">
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Workflow</th>
            <th scope="col">Status</th>
            <th scope="col">Started</th>
            <th scope="col">Latency</th>
            <th scope="col">Tokens</th>
            <th scope="col">Retries</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.id}
              className={run.id === selectedId ? 'is-selected' : undefined}
              aria-current={run.id === selectedId || undefined}
              onClick={() => onSelect(run.id)}
            >
              <td>
                {/* The button makes rows keyboard-accessible; its click bubbles to the row handler. */}
                <button type="button" className="link-button">
                  {run.id}
                </button>
              </td>
              <td>{run.workflowName}</td>
              <td>
                <StatusBadge status={run.status} />
              </td>
              <td>{formatDateTime(run.startedAt)}</td>
              <td>{formatLatency(run.latencyMs)}</td>
              <td>{formatNumber(run.tokenCount)}</td>
              <td>{run.retries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
