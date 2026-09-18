import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { db } from '../msw/handlers';
import { server } from '../msw/server';
import { createTestQueryClient } from '../utils';

const renderApp = () => render(<App queryClient={createTestQueryClient()} />);

const runRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('button').textContent);

const openRun = async (id: string) => {
  await userEvent.click(await screen.findByRole('button', { name: id }));
  return screen.findByRole('complementary', { name: `Run ${id} details` });
};

describe('Workflow runs console', () => {
  it('shows a loading state, then all runs newest first', async () => {
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent('Loading runs…');
    await screen.findByRole('table');
    expect(runRows()).toEqual(['run-1006', 'run-1005', 'run-1004', 'run-1003', 'run-1002', 'run-1001']);
  });

  it('works with the default query client', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'run-1001' })).toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderApp();
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'failed');
    await waitFor(() => expect(runRows()).toEqual(['run-1006', 'run-1004', 'run-1001']));
  });

  it('searches by workflow name (debounced) and shows an empty state', async () => {
    renderApp();
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText('Search workflow'), 'legal');
    await waitFor(() => expect(runRows()).toEqual(['run-1005']));

    await userEvent.clear(screen.getByLabelText('Search workflow'));
    await userEvent.type(screen.getByLabelText('Search workflow'), 'zzz');
    expect(await screen.findByText('No runs match your filters.')).toBeInTheDocument();
  });

  it('shows an error state for the list and recovers on "Try again"', async () => {
    server.use(
      http.get('*/api/runs', () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 }), {
        once: true,
      }),
    );
    renderApp();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('opens run details with steps and errors, and closes them', async () => {
    renderApp();
    const details = await openRun('run-1004');
    expect(await within(details).findByText('onboarding-summary')).toBeInTheDocument();
    expect(within(details).getByRole('note')).toHaveTextContent('Vector store unavailable during retrieve step');
    expect(within(details).getByRole('list', { name: 'Steps' })).toHaveTextContent('retrievefailedVector store unavailable');

    await userEvent.click(within(details).getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('does not show retry for successful runs', async () => {
    renderApp();
    const details = await openRun('run-1002');
    await within(details).findByText('invoice-extraction');
    expect(within(details).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(within(details).queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows a details error state and recovers', async () => {
    server.use(http.get('*/api/runs/:id', () => HttpResponse.error(), { once: true }));
    renderApp();
    const details = await openRun('run-1001');
    expect(await within(details).findByRole('alert')).toHaveTextContent('Could not reach the server');
    await userEvent.click(within(details).getByRole('button', { name: 'Try again' }));
    expect(await within(details).findByText('contract-review')).toBeInTheDocument();
  });

  it('retries a failed run, then polls until it succeeds and refreshes the list', async () => {
    renderApp();
    const details = await openRun('run-1001');
    await userEvent.click(await within(details).findByRole('button', { name: 'Retry' }));

    expect(await within(details).findByText('Retry started. Progress updates automatically.')).toBeInTheDocument();
    await waitFor(() => expect(within(details).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument());
    await waitFor(
      () => expect(within(details).getByRole('list', { name: 'Steps' })).not.toHaveTextContent(/failed|pending|running/),
      { timeout: 3000 },
    );
    const row = screen.getAllByRole('row').find((r) => within(r).queryByText('run-1001'))!;
    await waitFor(() => expect(row).toHaveTextContent('success'), { timeout: 3000 });
    expect(row).toHaveTextContent(/2$/);
  });

  describe('keeps a filtered list in sync when a retried run fails again', () => {
    const retryUnderFailedFilter = async () => {
      db.retryOutcome = 'failed';
      renderApp();
      await screen.findByRole('table');
      await userEvent.selectOptions(screen.getByLabelText('Status'), 'failed');
      await waitFor(() => expect(runRows()).toEqual(['run-1006', 'run-1004', 'run-1001']));
      const details = await openRun('run-1001');
      await userEvent.click(await within(details).findByRole('button', { name: 'Retry' }));
      await within(details).findByText(/Retry started/);
      // While running, the run no longer matches the "failed" filter...
      await waitFor(() => expect(runRows()).toEqual(['run-1006', 'run-1004']));
      return details;
    };

    const expectRunBackAsFailed = async () => {
      // ...and once execution fails again it must reappear without any manual refresh.
      await waitFor(() => expect(runRows()).toEqual(['run-1006', 'run-1004', 'run-1001']), { timeout: 4000 });
      const row = screen.getAllByRole('row').find((r) => within(r).queryByText('run-1001'))!;
      expect(row).toHaveTextContent('failed');
      expect(row).toHaveTextContent(/2$/);
    };

    it('with the details panel open', async () => {
      const details = await retryUnderFailedFilter();
      await waitFor(() => expect(within(details).getByRole('note')).toHaveTextContent('during ingest step'), { timeout: 4000 });
      await expectRunBackAsFailed();
    }, 10_000);

    it('after the details panel was closed', async () => {
      const details = await retryUnderFailedFilter();
      await userEvent.click(within(details).getByRole('button', { name: 'Close details' }));
      await expectRunBackAsFailed();
    }, 10_000);
  });

  it('sends only one retry when the button is clicked rapidly', async () => {
    renderApp();
    const details = await openRun('run-1006');
    const button = await within(details).findByRole('button', { name: 'Retry' });
    await userEvent.tripleClick(button);
    await userEvent.click(button);

    await within(details).findByText(/Retry started/);
    expect(db.retryRequests).toHaveLength(1);
    expect(db.find('run-1006')!.retries).toBe(3);
  });

  it('retries only the failed step', async () => {
    renderApp();
    const details = await openRun('run-1004');
    await userEvent.click(await within(details).findByRole('button', { name: 'Retry retrieve step only' }));
    await within(details).findByText(/Retry started/);
    expect(db.retryRequests).toEqual([expect.objectContaining({ mode: 'failed_step', stepName: 'retrieve' })]);
  });

  it('shows a clear error when the server rejects the retry', async () => {
    server.use(
      http.post('*/api/runs/:id/retry', () =>
        HttpResponse.json({ error: { code: 'RATE_LIMITED', message: 'Too many retry requests, slow down' } }, { status: 429 }),
      ),
    );
    renderApp();
    const details = await openRun('run-1001');
    await userEvent.click(await within(details).findByRole('button', { name: 'Retry' }));
    expect(await within(details).findByRole('alert')).toHaveTextContent('Retry failed: Too many retry requests, slow down');
    expect(within(details).getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('shows an "Updating…" hint while refetching existing results', async () => {
    // Returning nothing falls through to the default handler, after a visible delay.
    server.use(http.get('*/api/runs', async () => void (await delay(200))));
    renderApp();
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'success');
    expect(await screen.findByText('Updating…')).toBeInTheDocument();
    await waitFor(() => expect(runRows()).toEqual(['run-1005', 'run-1002']));
  });
});
