import { test, expect } from '@playwright/test';

const DRAWERS = ['Today', 'Calendar', 'To-do', 'Herb cabinet', 'Grimoire', 'Recipe book', 'Batch journal', 'Journal', 'Labels', 'Shopping list', 'Garden log'];

test('opens every drawer, saves a name, and greets by it', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Cabinet drawers' });
  for (const name of DRAWERS.slice(1)) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Your name').fill('Rowan');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText(/apothecary-\d{4}-\d{2}-\d{2}\.db/).first()).toBeVisible();
  await nav.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/, Rowan$/);
  await page.screenshot({ path: 'test-results/today.png', fullPage: true });
});
