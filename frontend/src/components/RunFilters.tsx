import { RUN_STATUSES, SEARCH_MAX_LENGTH, type RunStatus } from '@app/shared';

type Props = {
  status: RunStatus | '';
  search: string;
  onStatusChange: (status: RunStatus | '') => void;
  onSearchChange: (search: string) => void;
};

export function RunFilters({ status, search, onStatusChange, onSearchChange }: Props) {
  return (
    <div className="filters" role="search">
      <label>
        Status
        <select value={status} onChange={(event) => onStatusChange(event.target.value as RunStatus | '')}>
          <option value="">All</option>
          {RUN_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Search workflow
        <input
          type="search"
          value={search}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="e.g. contract-review"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
    </div>
  );
}
