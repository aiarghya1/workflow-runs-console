import { expect, test, type Page } from '@playwright/test';

/**
 * Full-stack flows against the real API (in-memory, RETRY_FAILURE_RATE=0 for determinism).
 * Each retry test uses a different failed run because the backend state is shared.
 */

const table = (page: Page) => page.getByRole('table');
const row = (page: Page, id: string) => table(page).getByRole('row').filter({ has: page.getByRole('button', { name: id, exact: true }) });
const details = (page: Page, id: string) => page.getByRole('complementary', { name: `Run ${id} details` });

const openRun = async (page: Page, id: string) => {
  await row(page, id).click();
  const panel = details(page, id);
  await expect(panel.getByRole('list', { name: 'Steps' })).toBeVisible();
  return panel;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(table(page).getByRole('row')).toHaveCount(7);
});

test('lists runs with all required fields', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Workflow runs' })).toBeVisible();
  await expect(table(page).getByRole('columnheader')).toHaveText(['Run', 'Workflow', 'Status', 'Started', 'Latency', 'Tokens', 'Retries']);
  await expect(row(page, 'run-1001')).toContainText(['contract-review', 'failed', 'Apr 9, 2026, 8:00 AM UTC', '14.5 s', '18,234', '1'].join(''));
});

test('filters by status and searches by workflow name', async ({ page }) => {
  await page.getByLabel('Status').selectOption('failed');
  await expect(table(page).getByRole('row')).toHaveCount(4);

  await page.getByLabel('Status').selectOption('');
  await page.getByLabel('Search workflow').fill('REVIEW');
  await expect(table(page).getByRole('row')).toHaveCount(2);
  await expect(row(page, 'run-1001')).toBeVisible();

  await page.getByLabel('Search workflow').fill('does-not-exist');
  await expect(page.getByText('No runs match your filters.')).toBeVisible();
});

test('shows run details with step status and errors', async ({ page }) => {
  const panel = await openRun(page, 'run-1003');
  await expect(panel.getByRole('listitem')).toHaveText(['ingestsuccess', 'retrieverunning', 'generatepending', 'reviewpending']);
  await expect(panel.getByRole('button', { name: /^Retry/ })).toHaveCount(0);

  await row(page, 'run-1004').click();
  const failed = details(page, 'run-1004');
  await expect(failed.getByRole('note')).toHaveText('Vector store unavailable during retrieve step');
  await expect(failed.getByRole('listitem').nth(1)).toHaveText('retrievefailedVector store unavailable');

  await failed.getByRole('button', { name: 'Close details' }).click();
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('retries a failed run and follows it to success', async ({ page }) => {
  const panel = await openRun(page, 'run-1001');
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();

  await expect(panel.getByRole('status')).toHaveText('Retry started. Progress updates automatically.');
  await expect(panel.getByRole('listitem')).toHaveText(
    ['ingestsuccess', 'retrievesuccess', 'generatesuccess', 'reviewsuccess'],
    { timeout: 10_000 },
  );
  await expect(row(page, 'run-1001')).toContainText('success', { timeout: 10_000 });
  await expect(row(page, 'run-1001').getByRole('cell').last()).toHaveText('2');
});

test('rapid clicks on Retry send exactly one retry request', async ({ page }) => {
  const retryPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/retry')) retryPosts.push(request.url());
  });

  const panel = await openRun(page, 'run-1006');
  const button = panel.getByRole('button', { name: 'Retry', exact: true });
  await button.click({ clickCount: 5, delay: 0 });

  await expect(panel.getByRole('status')).toContainText('Retry started');
  await expect(panel.getByRole('listitem').last()).toHaveText('reviewsuccess', { timeout: 10_000 });
  expect(retryPosts).toHaveLength(1);
  await expect(row(page, 'run-1006').getByRole('cell').last()).toHaveText('3');
});

test('retries only the failed step, keeping earlier successful steps', async ({ page }) => {
  const panel = await openRun(page, 'run-1004');
  const requestPromise = page.waitForRequest((request) => request.method() === 'POST');
  await panel.getByRole('button', { name: 'Retry retrieve step only' }).click();

  expect((await requestPromise).postDataJSON()).toMatchObject({ runId: 'run-1004', mode: 'failed_step', stepName: 'retrieve' });
  await expect(panel.getByRole('listitem')).toHaveText(
    ['ingestsuccess', 'retrievesuccess', 'generatesuccess', 'reviewsuccess'],
    { timeout: 10_000 },
  );
});

test('shows an error state when the API fails and recovers on retry', async ({ page }) => {
  let failures = 3; // the client retries 5xx twice before showing an error
  await page.route('**/api/runs/run-1005', (route) =>
    failures-- > 0
      ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } } })
      : route.continue(),
  );
  await row(page, 'run-1005').click();
  const panel = details(page, 'run-1005');
  await expect(panel.getByRole('alert')).toContainText('Something went wrong', { timeout: 10_000 });
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(panel.getByText('legal-qa')).toBeVisible();
});
