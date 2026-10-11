import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });
const pad = n => String(n).padStart(2, '0');
const dayFromNow = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const STAMP = Date.now().toString(36);
const PLANT = `E2E calendula ${STAMP}`;
const SECOND = `E2E lavender ${STAMP}`;
const SOMETHING = `E2E wild elder ${STAMP}`;

test('keeps a garden from planting to the cabinet', async ({ page, request }) => {
  test.setTimeout(180000);
  fs.mkdirSync('test-results', { recursive: true });

  // 1. Add a plant from a grimoire herb: the name fills in, and the plant page shows the herb's garden notes.
  const herbs = await (await request.get('/api/herbs')).json();
  const calendula = herbs.find(h => h.common_name === 'Calendula');
  expect(calendula).toBeTruthy();
  await page.goto(`/garden/plants/new?herb=${calendula.id}`);
  const name = page.getByLabel('Name (required)');
  await slowExpect(name).toHaveValue('Calendula');
  await name.fill(PLANT);
  await page.getByLabel('Place').fill('the e2e bed');
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: PLANT })).toBeVisible();
  const plantUrl = page.url();
  const plantId = Number(plantUrl.split('/').pop());
  await expect(page.getByRole('heading', { name: 'In the garden' })).toBeVisible();
  await expect(page.getByText('Part harvested')).toBeVisible();
  await expect(page.getByText('Sun', { exact: true })).toBeVisible();

  // 2. Log a harvest for it: the entry page shows the moon. Send it to the cabinet and the entry links to the new jar.
  await page.getByRole('link', { name: 'Log something' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Log something' })).toBeVisible();
  await page.getByLabel('What you did (required)').selectOption({ label: 'Harvested' });
  await expect(page.getByLabel('Plant')).toHaveValue(String(plantId));
  await page.getByLabel('Amount').fill('25');
  await page.getByLabel('Unit').selectOption({ label: 'g' });
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: `Harvested ${PLANT}` })).toBeVisible();
  await expect(page.getByText(/^The moon that day: .+ in .+/)).toBeVisible();
  const entryUrl = page.url();
  await page.getByRole('link', { name: 'Send to the cabinet' }).click();
  await expect(page.getByText('From your garden log')).toBeVisible();
  await slowExpect(page.getByLabel('Name (required)')).toHaveValue(PLANT);
  await expect(page.getByLabel('Amount (required)')).toHaveValue('25');
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: PLANT })).toBeVisible();
  await expect(page).toHaveURL(/\/cabinet\/items\/\d+$/);
  await page.goto(entryUrl);
  await slowExpect(page.getByText('Jar:')).toBeVisible();
  await expect(page.getByRole('region', { name: 'In the cabinet' }).getByRole('link', { name: PLANT })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send to the cabinet' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: `Harvested ${PLANT}` })).toBeVisible();
  await page.screenshot({ path: 'test-results/garden-entry.png', fullPage: true });

  // 3. Log a foraging entry with "Something else": the foraging note shows.
  await page.goto('/garden/entries/new');
  await slowExpect(page.getByLabel('What you did (required)')).toBeVisible();
  await page.getByLabel('What you did (required)').selectOption({ label: 'Foraged' });
  await expect(page.getByText('Only gather a plant you can identify with complete certainty')).toBeVisible();
  await page.getByLabel('Plant').selectOption({ label: 'Something else' });
  await page.getByLabel('Name (required)').fill(SOMETHING);
  await page.getByLabel('Place').fill('the e2e hedge');
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: `Foraged ${SOMETHING}` })).toBeVisible();
  await expect(page.getByText('Only gather a plant you can identify with complete certainty')).toBeVisible();

  // 4. An expected harvest in 3 days puts a Harvest task on the to-do list and the harvest on the calendar.
  // A second plant, because a harvest already logged for the first one would quiet its reminder.
  const soon = dayFromNow(3);
  const made = await request.post('/api/garden/plants', { data: { name: SECOND } });
  expect(made.ok()).toBe(true);
  const second = await made.json();
  await page.goto(`/garden/plants/${second.id ?? second.plant?.id}/edit`);
  await slowExpect(page.getByLabel('Expected harvest')).toBeVisible();
  await page.getByLabel('Expected harvest').fill(soon);
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: SECOND })).toBeVisible();
  await page.goto('/todo?view=upcoming');
  await slowExpect(page.getByRole('link', { name: `Harvest ${SECOND}` })).toBeVisible();
  await page.goto(`/calendar/${soon}`);
  await slowExpect(page.getByRole('link', { name: `Harvest ${SECOND}` })).toBeVisible();

  // 5. The Garden page's moon card shows day chips, and a calendar day page lists "In the garden".
  await page.goto('/garden');
  const card = page.getByRole('heading', { name: 'By the moon, the next four weeks' });
  await slowExpect(card).toBeVisible();
  const chip = page.locator('.moon-garden a.chip').first();
  await slowExpect(chip).toBeVisible();
  await expect(page.getByText(PLANT).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/garden.png', fullPage: true });
  await chip.click();
  await slowExpect(page).toHaveURL(/\/calendar\/\d{4}-\d{2}-\d{2}$/);
  await slowExpect(page.getByRole('heading', { name: 'In the garden' })).toBeVisible();
});
