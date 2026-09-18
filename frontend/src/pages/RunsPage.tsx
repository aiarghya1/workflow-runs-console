import type { RunStatus } from '@app/shared';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import { RunDetails } from '../components/RunDetails';
import { RunFilters } from '../components/RunFilters';
import { RunsTable } from '../components/RunsTable';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRuns } from '../hooks/useRuns';

export const SEARCH_DEBOUNCE_MS = 300;

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
  const closeDetails = useCallback(() => setSelectedId(null), []);

  return (
    <div className="layout">
      <header className="page-header">
        <h1>Workflow runs</h1>
        {isFetching && !isPending && <span className="muted">Updating…</span>}
      </header>

      <main className="content">
        <section className="list" aria-label="Workflow runs">
          <RunFilters status={status} search={search} onStatusChange={setStatus} onSearchChange={setSearch} />
          {isPending && <LoadingState label="Loading runs…" />}
          {error && <ErrorState error={error} onRetry={() => void refetch()} />}
          {data && data.items.length === 0 && <EmptyState message="No runs match your filters." />}
          {data && data.items.length > 0 && <RunsTable runs={data.items} selectedId={selectedId} onSelect={setSelectedId} />}
        </section>

        {/* key resets retry feedback and in-flight guards when switching runs */}
        {selectedId && <RunDetails key={selectedId} runId={selectedId} onClose={closeDetails} />}
      </main>
    </div>
  );
}
