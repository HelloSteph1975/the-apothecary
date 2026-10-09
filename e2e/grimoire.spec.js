import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('browses the grimoire, links a jar, and adds and removes an herb', async ({ page }) => {
  test.setTimeout(90000);
  fs.mkdirSync('test-results', { recursive: true });

  // The 30 starter herbs.
  await page.goto('/grimoire');
  const herbLinks = page.locator('.herb-card h2 a');
  await expect(herbLinks).toHaveCount(30);
  await page.screenshot({ path: 'test-results/grimoire.png', fullPage: true });

  // Search by Latin name narrows the list to Lavender.
  await page.getByRole('searchbox', { name: 'Search' }).fill('lavandula');
  await expect(herbLinks).toHaveCount(1);
  await expect(herbLinks.first()).toHaveText('Lavender');

  // Cautions come before uses.
  await herbLinks.first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lavender' })).toBeVisible();
  const before = page.getByRole('heading', { name: 'Before you use it' });
  const uses = page.getByRole('heading', { name: 'Uses in tradition' });
  await expect(before).toBeVisible();
  await expect(uses).toBeVisible();
  const [beforeBox, usesBox] = [await before.boundingBox(), await uses.boundingBox()];
  expect(beforeBox.y < usesBox.y || (beforeBox.y === usesBox.y && beforeBox.x < usesBox.x)).toBe(true);
  await page.screenshot({ path: 'test-results/herb.png', fullPage: true });

  // Add a jar from the herb page; Lavender is preselected.
  await page.getByRole('link', { name: 'Add a jar of this herb' }).click();
  const herbSelect = page.getByLabel('Grimoire herb');
  await expect(herbSelect).toBeVisible();
  await expect(herbSelect.locator('option:checked')).toHaveText(/Lavender/);
  await page.getByLabel('Name (required)').fill('Lavender buds (grimoire walk-through)');
  await page.getByLabel('Amount (required)').fill('30');
  await page.getByLabel('Unit').selectOption({ label: 'g' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lavender buds (grimoire walk-through)' })).toBeVisible();

  await page.goto('/grimoire');
  await page.getByRole('searchbox', { name: 'Search' }).fill('lavandula');
  await page.locator('.herb-card h2 a', { hasText: 'Lavender' }).click();
  const cabinet = page.locator('section, div, article').filter({ has: page.getByRole('heading', { name: 'In your cabinet' }) }).last();
  await expect(cabinet.getByRole('link', { name: 'Lavender buds (grimoire walk-through)' })).toBeVisible();

  // A new herb with one source.
  await page.goto('/grimoire/new');
  await page.getByLabel('Common name (required)').fill('Blue vervain');
  await page.getByRole('button', { name: 'Add source' }).click();
  await page.getByLabel('Title (required)').fill('A walk-through herbal');
  await page.getByLabel('Author').fill('Test Author');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Blue vervain' })).toBeVisible();
  await expect(page.getByText('A walk-through herbal')).toBeVisible();

  // Delete, then undo.
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Grimoire' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Blue vervain' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Blue vervain' })).toBeVisible();
});
