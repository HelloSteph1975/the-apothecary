import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const STAMP = Date.now().toString(36);
const WEEKLY = `E2E weekly ${STAMP}`;
const JAR = `E2E moonwort ${STAMP}`;
const DAY_TASK = `E2E day task ${STAMP}`;

test('plans with the to-do list and the calendar', async ({ page, request }) => {
  test.setTimeout(180000);
  fs.mkdirSync('test-results', { recursive: true });

  // 1. A weekly task due today: check it done and see the next date in the toast and on Upcoming.
  await page.goto('/todo');
  await page.getByRole('button', { name: 'Add a task' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a task' });
  await dialog.getByLabel('Title').fill(WEEKLY);
  await dialog.getByLabel('Due date').fill(TODAY);
  await dialog.getByLabel('Repeat', { exact: true }).selectOption({ label: 'Every week' });
  await dialog.getByLabel(now.toLocaleDateString('en-US', { weekday: 'long' })).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('link', { name: WEEKLY })).toBeVisible();
  await page.getByRole('checkbox', { name: `Done: ${WEEKLY}` }).click();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  await slowExpect(page.getByText(`Next: ${next}`)).toBeVisible();
  await page.getByRole('navigation', { name: 'To-do views' }).getByRole('link', { name: 'Upcoming' }).click();
  await slowExpect(page.getByRole('link', { name: WEEKLY })).toBeVisible();

  // 2. A jar at its low threshold makes a Restock task. Dismiss it, restock, lower the jar again, and it returns.
  const sections = await (await request.get('/api/sections')).json();
  const herbs = sections.find(s => s.name === 'Herbs') ?? sections[0];
  const made = await request.post('/api/items', { data: { section_id: herbs.id, name: JAR, amount: 5, unit: 'g', low_threshold: 10 } });
  expect(made.ok()).toBe(true);
  const jar = await made.json();
  const jarId = jar.id ?? jar.item?.id;
  await page.goto('/todo');
  const restock = page.getByRole('link', { name: `Restock ${JAR}` });
  await slowExpect(restock).toBeVisible();
  await page.getByRole('button', { name: `Actions for Restock ${JAR}` }).click();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Dismiss' }).click();
  await slowExpect(restock).toHaveCount(0);
  await page.reload();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'To-do' })).toBeVisible();
  await expect(restock).toHaveCount(0);

  await page.goto(`/cabinet/items/${jarId}`);
  await page.getByRole('button', { name: 'Restock' }).click();
  await page.getByLabel('Quantity').fill('50');
  await page.getByRole('dialog').getByRole('button', { name: 'Restock' }).click();
  await slowExpect(page.getByText('55 g').first()).toBeVisible();
  await page.goto(`/cabinet/items/${jarId}/edit`);
  await page.getByLabel('Amount (required)').fill('4');
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: JAR })).toBeVisible();
  await page.goto('/todo');
  await slowExpect(restock).toBeVisible();

  // 3. The calendar month: labelled day cells and a full moon marker. Then add a task from a day page.
  await page.goto('/calendar');
  await slowExpect(page.getByRole('link', { name: new RegExp(`^${now.toLocaleDateString('en-US', { weekday: 'long' })}, `) }).first()).toBeVisible();
  const full = page.locator('a.cal-day[aria-label*="full moon"]');
  if (await full.count() === 0) {
    await page.getByRole('button', { name: 'Next' }).click();
    await slowExpect(full.first()).toBeVisible();
  }
  await expect(full.first().locator('.cal-badge')).toHaveText('Full moon');
  await page.getByRole('button', { name: 'Today' }).click();
  await slowExpect(page.locator(`a.cal-day[data-day="${TODAY}"]`)).toBeVisible();
  await page.screenshot({ path: 'test-results/calendar.png', fullPage: true });

  await page.goto(`/calendar/${TODAY}`);
  await page.getByRole('link', { name: 'Add a task for this day' }).click();
  const add = page.getByRole('dialog', { name: 'Add a task' });
  await expect(add.getByLabel('Due date')).toHaveValue(TODAY);
  await add.getByLabel('Title').fill(DAY_TASK);
  await add.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('link', { name: DAY_TASK })).toBeVisible();
  await page.goto(`/calendar/${TODAY}`);
  await slowExpect(page.getByRole('link', { name: DAY_TASK })).toBeVisible();

  // 4. Today's Tasks card lists it.
  await page.goto('/');
  const card = page.locator('section, article, div').filter({ has: page.getByRole('heading', { name: 'Tasks' }) }).last();
  await slowExpect(card.getByRole('link', { name: DAY_TASK })).toBeVisible();
  await page.goto('/todo');
  await slowExpect(page.getByRole('link', { name: DAY_TASK })).toBeVisible();
  await page.screenshot({ path: 'test-results/todo.png', fullPage: true });

  // Leave the shared folder as it was found, so later specs see no low jar.
  await request.delete(`/api/items/${jarId}`);
});
