import { RUN_STATUSES, SEARCH_MAX_LENGTH, type RunStatus } from '@app/shared';
import { SearchIcon } from './Icons';

type Props = {
  status: RunStatus | '';
  search: string;
  onStatusChange: (status: RunStatus | '') => void;
  onSearchChange: (search: string) => void;
};

export function RunFilters({ status, search, onStatusChange, onSearchChange }: Props) {
  return (
    <div className="toolbar" role="search">
      <label className="field field--search">
        <span className="field__label">Search workflow</span>
        <SearchIcon />
        <input
          type="search"
          value={search}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Search workflows…"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Status</span>
        <select value={status} onChange={(event) => onStatusChange(event.target.value as RunStatus | '')}>
          <option value="">All statuses</option>
          {RUN_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
