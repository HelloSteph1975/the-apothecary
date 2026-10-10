import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const STAMP = Date.now().toString(36);
const TITLE = `E2E moon rite ${STAMP}`;
const TAG_A = `e2e-rite-${STAMP}`;
const TAG_B = `e2e-moon-${STAMP}`;
const NEW_TYPE = `E2E type ${STAMP}`;
const MOVED = `E2E moved entry ${STAMP}`;
const MOON_LABELS = { new: 'New moon', waxing: 'Waxing', full: 'Full moon', waning: 'Waning' };
// A 1x1 PNG, enough for the client to resize and upload.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('keeps a journal from entry to gallery', async ({ page, request }) => {
  test.setTimeout(180000);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/pixel.png', PNG);

  // 1. Write an entry with two tags and a linked herb. The page shows the sky line and the tags.
  await page.goto('/journal/new');
  await page.getByLabel('Title (required)').fill(TITLE);
  await page.getByLabel('Type (required)').selectOption({ label: 'Ritual' });
  await page.getByLabel('Body').fill('Lit a candle and sat with the moon for a while.');
  const tags = page.getByLabel('Tags', { exact: true });
  await tags.fill(TAG_A);
  await tags.press('Enter');
  await tags.fill(`${TAG_B},`);
  await page.getByLabel('Link to', { exact: true }).selectOption({ label: 'Herb' });
  await page.getByLabel('Record', { exact: true }).selectOption({ label: 'Calendula' });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The sky that day' })).toBeVisible();
  await expect(page.getByText(/ in .*, .* under /).first()).toBeVisible();
  await expect(page.getByRole('link', { name: TAG_A })).toBeVisible();
  await expect(page.getByRole('link', { name: TAG_B })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calendula' })).toBeVisible();
  const entryUrl = page.url();
  const entryId = Number(entryUrl.split('/').pop());
  const detail = await (await request.get(`/api/journal/${entryId}`)).json();

  // Search finds it.
  await page.goto('/journal');
  await page.getByLabel('Search').fill(TITLE);
  await slowExpect(page.getByRole('link', { name: TITLE })).toBeVisible();
  await page.getByLabel('Search').fill(`no-such-entry-${STAMP}`);
  await slowExpect(page.getByText('No entries match.')).toBeVisible();

  // 2. By tag lists it, and By moon puts it under the right group.
  await page.goto('/journal');
  const views = page.getByRole('navigation', { name: 'Journal views' });
  await views.getByRole('link', { name: 'By tag' }).click();
  await page.getByRole('button', { name: new RegExp(`^${TAG_A}`) }).click();
  await slowExpect(page.getByRole('link', { name: TITLE })).toBeVisible();
  await views.getByRole('link', { name: 'By moon' }).click();
  const group = page.getByRole('region', { name: new RegExp(`^${MOON_LABELS[detail.sky_phase_group]}`) });
  await slowExpect(group.getByRole('link', { name: TITLE })).toBeVisible();

  // 3. Add an entry type, then delete it while it has an entry, moving the entry to Note.
  await page.goto('/journal/types');
  await page.getByRole('button', { name: 'Add a type' }).click();
  const typeDialog = page.getByRole('dialog', { name: 'Add an entry type' });
  await typeDialog.getByLabel('Name').fill(NEW_TYPE);
  await typeDialog.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByText(NEW_TYPE)).toBeVisible();
  await page.goto('/journal/new');
  await page.getByLabel('Title (required)').fill(MOVED);
  await page.getByLabel('Type (required)').selectOption({ label: NEW_TYPE });
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: MOVED })).toBeVisible();
  await page.goto('/journal/types');
  await page.getByRole('button', { name: `Delete ${NEW_TYPE}` }).click();
  const moveDialog = page.getByRole('dialog', { name: `Delete ${NEW_TYPE}` });
  await moveDialog.getByLabel(/^Move its 1 entry to/).selectOption({ label: 'Note' });
  await moveDialog.getByRole('button', { name: 'Move and delete' }).click();
  await slowExpect(page.getByText(NEW_TYPE, { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to the journal' }).click();
  await page.getByRole('link', { name: MOVED }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: MOVED })).toBeVisible();
  await expect(page.getByText(/^Note, /)).toBeVisible();

  // 4. The calendar shows the entry on its day, and the day page prefills the date.
  await page.goto(`/calendar/${TODAY}`);
  await slowExpect(page.getByRole('link', { name: TITLE })).toBeVisible();
  await page.getByRole('link', { name: 'Add a journal entry' }).click();
  await expect(page.getByLabel('Date')).toHaveValue(TODAY);

  // 5. A photo on the entry shows in the gallery with the entry's name, and opens in a dialog.
  await page.goto(entryUrl);
  await page.locator('input[type=file]').setInputFiles('test-results/pixel.png');
  await expect(page.locator('.gallery-item img')).toBeVisible();
  await page.screenshot({ path: 'test-results/journal.png', fullPage: true });
  await page.goto('/journal/photos');
  const tile = page.getByRole('button', { name: `View larger: ${TITLE} photo` });
  await slowExpect(tile).toBeVisible();
  await expect(page.getByRole('link', { name: `Journal entry: ${TITLE}` })).toBeVisible();
  await page.screenshot({ path: 'test-results/gallery.png', fullPage: true });
  await tile.click();
  await expect(page.getByRole('dialog', { name: TITLE })).toBeVisible();
});
