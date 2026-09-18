import type { RunStatus } from '@app/shared';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import { LogoIcon } from '../components/Icons';
import { RunDetails } from '../components/RunDetails';
import { RunFilters } from '../components/RunFilters';
import { RunsTable } from '../components/RunsTable';
import { StatsBar } from '../components/StatsBar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRetriedRunsWatcher, useRuns } from '../hooks/useRuns';

export const SEARCH_DEBOUNCE_MS = 300;

const NO_FILTERS = {};

export function RunsPage() {
  const [status, setStatus] = useState<RunStatus | ''>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const filters = useMemo(
    () => ({ status: status || undefined, search: debouncedSearch || undefined }),
    [status, debouncedSearch],
  );
  const { data, isPending, isFetching, error, refetch } = useRuns(filters);
  // Unfiltered list for the summary tiles. With no filters active it is the same cached query as above.
  const { data: allRuns } = useRuns(NO_FILTERS);
  const closeDetails = useCallback(() => setSelectedId(null), []);
  useRetriedRunsWatcher();

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <span className="brand">
            <span className="brand__mark">
              <LogoIcon />
            </span>
            Workflow Ops
          </span>
          <span className="env-pill">In-memory demo</span>
        </div>
      </header>

      <div className="layout">
        <header className="page-header">
          <div>
            <h1>Workflow runs</h1>
            <p className="page-header__subtitle">Inspect AI workflow runs and safely retry the ones that failed.</p>
          </div>
          {isFetching && !isPending && (
            <span className="live-indicator">
              <span className="live-indicator__dot" aria-hidden="true" />
              Updating…
            </span>
          )}
        </header>

        <StatsBar runs={allRuns?.items} active={status} onSelect={setStatus} />

        <main className={selectedId ? 'content content--with-details' : 'content'}>
          <section className="card list" aria-label="Workflow runs">
            <RunFilters status={status} search={search} onStatusChange={setStatus} onSearchChange={setSearch} />
            {isPending && <LoadingState label="Loading runs…" />}
            {error && <ErrorState error={error} onRetry={() => void refetch()} />}
            {data && data.items.length === 0 && <EmptyState message="No runs match your filters." />}
            {data && data.items.length > 0 && (
              <RunsTable runs={data.items} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </section>

          {/* key resets retry feedback and in-flight guards when switching runs */}
          {selectedId && <RunDetails key={selectedId} runId={selectedId} onClose={closeDetails} />}
          {/* Dims the page behind the mobile bottom sheet; hidden on wide screens. */}
          {selectedId && <div className="backdrop" aria-hidden="true" onClick={closeDetails} />}
        </main>
      </div>
    </>
  );
}
