import { expect, test } from '@playwright/test';

const html = (page: import('@playwright/test').Page) => page.locator('html');

test('System follows the OS color scheme, including live changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});

test('an explicit choice changes the colors and survives a reload without a flash', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBg).not.toBe(lightBg);

  // The pre-paint script in index.html must apply the saved theme before React loads.
  await page.route('**/src/main.tsx', (route) => route.abort());
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  await page.unrouteAll();

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await page.getByRole('radio', { name: 'Light' }).check();
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});
