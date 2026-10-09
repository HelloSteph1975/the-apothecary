import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
// A 1x1 PNG, enough for the client to resize and upload.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('stocks the cabinet from supplier to photo', async ({ page }) => {
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/pixel.png', PNG);

  await page.goto('/cabinet/suppliers');
  await page.getByRole('link', { name: 'Add a supplier' }).click();
  await page.getByLabel('Name (required)').fill('Moonvale Botanicals');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Moonvale Botanicals' }).first()).toBeVisible();

  // Calendula, bought from Moonvale, with a suggested use by date.
  await page.goto('/cabinet');
  await page.getByRole('link', { name: 'Add to the cabinet' }).click();
  await page.getByLabel('Section (required)').selectOption({ label: 'Herbs' });
  await page.getByLabel('Name (required)').fill('Calendula');
  await page.getByLabel('Form', { exact: true }).selectOption({ label: 'Dried flower' });
  await page.getByLabel('Amount (required)').fill('40');
  await page.getByLabel('Unit').selectOption({ label: 'g' });
  await page.getByLabel('Low when at or below').fill('50');
  await page.getByLabel('Source').selectOption({ label: 'Bought' });
  await page.getByLabel('Supplier', { exact: true }).selectOption({ label: 'Moonvale Botanicals' });
  await page.getByLabel('Price').fill('9.50');
  await page.getByLabel('Date bought').fill(TODAY);
  await expect(page.getByLabel('Use by')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendula' })).toBeVisible();

  // On Shelves, running low.
  await page.getByRole('navigation', { name: 'Herb cabinet' }).getByRole('link', { name: 'Shelves' }).click();
  const row = page.getByRole('link', { name: /Calendula/ });
  await expect(row).toContainText('Running low');

  // Restock.
  await row.click();
  await page.getByRole('button', { name: 'Restock' }).click();
  await page.getByLabel('Quantity').fill('100');
  await page.getByRole('dialog').getByRole('button', { name: 'Restock' }).click();
  await expect(page.getByText('140 g').first()).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(3); // header plus two purchases

  // A supply.
  await page.goto('/cabinet/new');
  await page.getByLabel('Section (required)').selectOption({ label: 'Containers' });
  await page.getByLabel('Name (required)').fill('30 ml amber dropper bottle');
  await page.getByLabel('Amount (required)').fill('24');
  await page.getByLabel('Unit').selectOption({ label: 'Count' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '30 ml amber dropper bottle' })).toBeVisible();

  // Today no longer lists Calendula as low, and nothing breaks.
  await page.getByRole('navigation', { name: 'Cabinet drawers' }).getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Nothing is running low.')).toBeVisible();
  await expect(page.getByText('Calendula')).toHaveCount(0);

  // Photo becomes the cover on Shelves.
  await page.goto('/cabinet');
  await page.getByRole('link', { name: /Calendula/ }).click();
  await page.locator('input[type=file]').setInputFiles('test-results/pixel.png');
  await expect(page.locator('.gallery-item img')).toBeVisible();
  await page.screenshot({ path: 'test-results/item.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Herb cabinet' }).getByRole('link', { name: 'Shelves' }).click();
  await expect(page.getByRole('link', { name: /Calendula/ }).locator('img[src^="/photos/"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/shelves.png', fullPage: true });

  // Delete the bottle, then undo.
  await page.getByRole('link', { name: /dropper bottle/ }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('link', { name: /dropper bottle/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '30 ml amber dropper bottle' })).toBeVisible();
});
