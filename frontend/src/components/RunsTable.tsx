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
            <th scope="col" className="num">
              Latency
            </th>
            <th scope="col" className="num">
              Tokens
            </th>
            <th scope="col" className="num">
              Retries
            </th>
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
                <button type="button" className="run-id">
                  {run.id}
                </button>
              </td>
              <td className="cell-workflow">{run.workflowName}</td>
              <td>
                <StatusBadge status={run.status} />
              </td>
              <td className="muted">{formatDateTime(run.startedAt)}</td>
              <td className="num">{formatLatency(run.latencyMs)}</td>
              <td className="num">{formatNumber(run.tokenCount)}</td>
              <td className={run.retries > 0 ? 'num' : 'num muted'}>{run.retries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
