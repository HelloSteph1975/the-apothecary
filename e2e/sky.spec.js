import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });
const RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

test('shows the sky, switches suggestions off and on, edits timing rules and picks a start date', async ({ page }) => {
  test.setTimeout(150000);
  fs.mkdirSync('test-results', { recursive: true });

  // 1. A rule for today's ruling planet, so Today always has something to suggest.
  const ruler = RULERS[new Date().getDay()];
  await page.goto('/settings/timing-rules');
  await page.getByRole('button', { name: 'Add a rule' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a timing rule' });
  await slowExpect(dialog).toBeVisible();
  await dialog.getByLabel('Kind').selectOption({ label: 'Day ruler' });
  await dialog.getByLabel('Value').selectOption({ label: ruler });
  await dialog.getByLabel('Text').fill('Sky test: a steady day for slow work.');
  await dialog.getByLabel('Weight').selectOption({ label: 'Strong' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByText('Sky test: a steady day for slow work.').first()).toBeVisible();

  // 2. Today shows the sky line and the sky card, with the Folk tradition label.
  await page.goto('/');
  await slowExpect(page.getByText(/ in (Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces), \w+ under /).first()).toBeVisible();
  await slowExpect(page.getByText('Sky test: a steady day for slow work.')).toBeVisible();
  await expect(page.getByText('Folk tradition').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/today-sky.png', fullPage: true });

  // 3. Turn suggestions off: the facts stay, the suggestions go.
  await page.goto('/settings');
  const box = page.getByLabel('Show folk timing suggestions');
  await slowExpect(box).toBeChecked();
  await box.uncheck();
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/settings') && r.request().method() !== 'GET'),
    page.getByRole('button', { name: 'Save settings' }).click(),
  ]);
  await page.goto('/');
  await slowExpect(page.getByText('Suggestions are off. Turn them on in Settings.')).toBeVisible();
  await expect(page.getByText('Sky test: a steady day for slow work.')).toHaveCount(0);
  await expect(page.getByText(/ under /).first()).toBeVisible();

  // 4. Turn them back on.
  await page.goto('/settings');
  await slowExpect(box).not.toBeChecked();
  await box.check();
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/settings') && r.request().method() !== 'GET'),
    page.getByRole('button', { name: 'Save settings' }).click(),
  ]);
  await page.goto('/');
  await slowExpect(page.getByText('Sky test: a steady day for slow work.')).toBeVisible();

  // 5. Add "Moon in Cancer", see it listed, delete it and undo.
  await page.goto('/settings/timing-rules');
  await page.getByRole('button', { name: 'Add a rule' }).click();
  const d2 = page.getByRole('dialog', { name: 'Add a timing rule' });
  await slowExpect(d2).toBeVisible();
  await d2.getByLabel('Kind').selectOption({ label: 'Moon in a sign' });
  await d2.getByLabel('Value').selectOption({ label: 'Cancer' });
  await d2.getByLabel('Text').fill('Sky test: a soft time for tending.');
  await d2.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByText('Moon in Cancer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Moon in Cancer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await slowExpect(undo).toBeVisible();
  await expect(page.getByText('Moon in Cancer', { exact: true })).toHaveCount(0);
  await undo.click();
  await slowExpect(page.getByText('Moon in Cancer', { exact: true })).toBeVisible();

  // 6. Start a batch from a recipe and pick a suggested start date.
  await page.goto('/recipes/new');
  await page.getByLabel('Name (required)').fill('Sky test tea');
  await page.getByLabel('Type (required)').selectOption({ label: 'infused oil' });
  await page.getByLabel('Steps').fill('Steep and strain.');
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Sky test tea' })).toBeVisible();
  await page.getByRole('link', { name: 'Make this recipe' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Start a batch' })).toBeVisible();
  const days = page.getByRole('group', { name: 'Good days to start' });
  await slowExpect(days).toBeVisible();
  await expect(days.getByText('Folk tradition')).toBeVisible();
  await page.screenshot({ path: 'test-results/start-dates.png', fullPage: true });
  const date = page.getByLabel('Start date');
  const before = await date.inputValue();
  const buttons = days.getByRole('button');
  const n = await buttons.count();
  const pick = buttons.nth(n - 1);
  await pick.click();
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  await expect(date).not.toHaveValue(before);
});
