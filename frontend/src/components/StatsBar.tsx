import type { RunStatus, WorkflowRunSummary } from '@app/shared';

const TILES = [
  { label: 'All runs', status: '' },
  { label: 'Failed', status: 'failed' },
  { label: 'Running', status: 'running' },
  { label: 'Succeeded', status: 'success' },
] as const;

type Props = {
  /** Unfiltered runs; undefined while loading. */
  runs?: WorkflowRunSummary[];
  active: RunStatus | '';
  onSelect: (status: RunStatus | '') => void;
};

/** Summary counts that double as one-click status filters. */
export function StatsBar({ runs, active, onSelect }: Props) {
  return (
    <div className="stats" role="group" aria-label="Run summary">
      {TILES.map((tile) => {
        const count = runs && (tile.status ? runs.filter((run) => run.status === tile.status).length : runs.length);
        return (
          <button
            key={tile.label}
            type="button"
            className={`stat stat--${tile.status || 'all'}`}
            aria-pressed={active === tile.status}
            aria-label={`${tile.label}: ${count ?? 'loading'}`}
            onClick={() => onSelect(tile.status)}
          >
            <span className="stat__label">{tile.label}</span>
            <span className="stat__value">{count ?? '–'}</span>
          </button>
        );
      })}
    </div>
  );
}
