import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/Feedback';
import { RetryPanel } from '../../src/components/RetryPanel';
import { RunFilters } from '../../src/components/RunFilters';
import { RunsTable } from '../../src/components/RunsTable';
import { StatusBadge } from '../../src/components/StatusBadge';
import { StatsBar } from '../../src/components/StatsBar';
import { StepList } from '../../src/components/StepList';
import { ApiError } from '../../src/api/client';
import { makeRun, renderWithClient } from '../utils';

describe('StatusBadge', () => {
  it('renders the status with a status-specific class', () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByText('failed')).toHaveClass('badge', 'badge--failed');
  });
});

describe('StepList', () => {
  it('shows each step with its status and optional error', () => {
    render(<StepList steps={makeRun().steps} />);
    const items = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'ingestsuccess',
      'retrievesuccess',
      'generatefailedLLM provider timeout',
      'reviewpending',
    ]);
  });
});

describe('Feedback', () => {
  it('renders loading, empty and error states', async () => {
    const onRetry = vi.fn();
    render(
      <>
        <LoadingState label="Loading…" />
        <EmptyState message="Nothing here" />
        <ErrorState error={new ApiError(500, 'X', 'Server exploded')} onRetry={onRetry} />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Server exploded');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('RunFilters', () => {
  it('reports status and search changes', async () => {
    const onStatusChange = vi.fn();
    const onSearchChange = vi.fn();
    render(<RunFilters status="" search="" onStatusChange={onStatusChange} onSearchChange={onSearchChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'failed');
    expect(onStatusChange).toHaveBeenCalledWith('failed');
    await userEvent.type(screen.getByLabelText('Search workflow'), 'x');
    expect(onSearchChange).toHaveBeenCalledWith('x');
    expect(screen.getByLabelText('Search workflow')).toHaveAttribute('maxLength', '100');
  });
});

describe('RunsTable', () => {
  const runs = [
    { ...makeRun(), steps: undefined },
    { ...makeRun({ id: 'run-2', status: 'success', latencyMs: 640, retries: 0 }), steps: undefined },
  ];

  it('renders formatted run summaries and highlights the selected row', () => {
    render(<RunsTable runs={runs} selectedId="run-2" onSelect={vi.fn()} />);
    const [, first, second] = screen.getAllByRole('row');
    expect(first).toHaveTextContent('run-1contract-reviewfailedApr 9, 2026, 8:00 AM UTC14.5 s18,2341');
    expect(second).toHaveTextContent('640 ms');
    expect(second).toHaveClass('is-selected');
    expect(second).toHaveAttribute('aria-current', 'true');
    expect(first).not.toHaveAttribute('aria-current');
  });

  it('selects a run by clicking the row or activating its button with the keyboard', async () => {
    const onSelect = vi.fn();
    render(<RunsTable runs={runs} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('14.5 s'));
    expect(onSelect).toHaveBeenLastCalledWith('run-1');

    screen.getByRole('button', { name: 'run-2' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('run-2');
  });
});

describe('RetryPanel', () => {
  it('offers full and failed-step retry for a failed run', () => {
    renderWithClient(<RetryPanel run={makeRun()} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Retry generate step only' })).toBeEnabled();
  });

  it('offers only a full retry when no step is marked failed', () => {
    renderWithClient(<RetryPanel run={makeRun({ steps: [{ name: 'ingest', status: 'success' }] })} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it.each(['success', 'running'] as const)('offers no retry for a %s run', (status) => {
    renderWithClient(<RetryPanel run={makeRun({ status })} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables both buttons and shows progress while a retry is in flight', async () => {
    renderWithClient(<RetryPanel run={makeRun({ id: 'run-1001' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry generate step only' })).toBeDisabled();
    expect(await screen.findByRole('status')).toHaveTextContent('Retry started');
  });

  it('shows the server reason when a retry is rejected', async () => {
    renderWithClient(<RetryPanel run={makeRun({ id: 'run-1002' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry generate step only' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Retry failed: Run run-1002 is success; only failed runs can be retried',
    );
  });
});

describe('StatsBar', () => {
  const runs = [
    { ...makeRun({ id: 'a', status: 'failed' }), steps: undefined },
    { ...makeRun({ id: 'b', status: 'failed' }), steps: undefined },
    { ...makeRun({ id: 'c', status: 'success' }), steps: undefined },
  ];

  it('shows counts per status and marks the active filter', () => {
    render(<StatsBar runs={runs} active="failed" onSelect={vi.fn()} />);
    const tiles = within(screen.getByRole('group', { name: 'Run summary' })).getAllByRole('button');
    expect(tiles.map((tile) => tile.textContent)).toEqual(['All runs3', 'Failed2', 'Running0', 'Succeeded1']);
    expect(screen.getByRole('button', { name: 'Failed: 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All runs: 3' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows placeholders while loading and filters on click', async () => {
    const onSelect = vi.fn();
    render(<StatsBar active="" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Running: loading' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Running/ }));
    expect(onSelect).toHaveBeenLastCalledWith('running');
    await userEvent.click(screen.getByRole('button', { name: /^All runs/ }));
    expect(onSelect).toHaveBeenLastCalledWith('');
  });
});
