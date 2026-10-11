import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });
const pad = n => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const STAMP = Date.now().toString(36);
const SUPPLIER = `E2E Hedgerow Supply ${STAMP}`;
const JAR = `E2E low sage ${STAMP}`;
const BATCH = `E2E sage oil ${STAMP}`;
const THING = `E2E shea butter ${STAMP}`;

test('keeps a shopping list and makes labels', async ({ page, request }) => {
  test.setTimeout(180000);
  fs.mkdirSync('test-results', { recursive: true });

  // Set up a supplier, a jar below its threshold that was bought from them, and a batch.
  const sections = await (await request.get('/api/sections')).json();
  const herbs = sections.find(s => s.kind === 'herb');
  const supplier = await (await request.post('/api/suppliers', { data: { name: SUPPLIER } })).json();
  const made = await request.post('/api/items', {
    data: {
      section_id: herbs.id, name: JAR, amount: 3, unit: 'g', low_threshold: 20, source_kind: 'bought', acquired_on: today(),
      purchase: { supplier_id: supplier.id, price: 4, purchased_on: today() },
    },
  });
  expect(made.ok(), await made.text()).toBe(true);
  const jarId = (await made.json()).id;
  const batchMade = await request.post('/api/batches', {
    data: { name: BATCH, start_date: today(), lines: [{ name: 'Olive oil', amount: 10, unit: 'ml' }] },
  });
  expect(batchMade.ok(), await batchMade.text()).toBe(true);

  // 1. A jar below its threshold is on the list with its last supplier. Restocking it takes it off.
  await page.goto('/shopping');
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Shopping list' })).toBeVisible();
  const lowRow = page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: JAR }) });
  await slowExpect(lowRow).toBeVisible();
  await expect(lowRow.getByText(`Last from ${SUPPLIER}`)).toBeVisible();
  await lowRow.getByRole('button', { name: 'Restock' }).click();
  const restock = page.getByRole('dialog', { name: `Restock ${JAR}` });
  await slowExpect(restock).toBeVisible();
  await restock.getByLabel('Quantity (required)').fill('100');
  await restock.getByRole('button', { name: 'Restock' }).click();
  await slowExpect(page.getByRole('checkbox', { name: JAR })).toHaveCount(0);

  // 2. Add an item, group by supplier, check it, then buy it: the jar form starts filled in.
  await page.getByRole('button', { name: 'Add an item' }).click();
  const add = page.getByRole('dialog', { name: 'Add an item' });
  await slowExpect(add).toBeVisible();
  await add.getByLabel('Name (required)').fill(THING);
  await add.getByLabel('Quantity').fill('250 g');
  await add.getByLabel('Supplier').selectOption({ label: SUPPLIER });
  await add.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('checkbox', { name: THING })).toBeVisible();
  await page.getByRole('link', { name: 'Supplier', exact: true }).click();
  await expect(page).toHaveURL(/group=supplier/);
  await slowExpect(page.getByRole('heading', { name: SUPPLIER })).toBeVisible();
  await page.getByRole('checkbox', { name: THING }).click();
  await slowExpect(page.getByRole('checkbox', { name: THING })).toBeChecked();
  await page.screenshot({ path: 'test-results/shopping.png' });
  await page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: THING }) }).getByRole('link', { name: 'Bought' }).click();
  await expect(page).toHaveURL(/\/cabinet\/new\?shopping=\d+/);
  await expect(page.getByText('From your shopping list')).toBeVisible();
  await slowExpect(page.getByLabel('Name (required)')).toHaveValue(THING);
  await page.getByLabel('Section (required)').selectOption({ label: 'Herbs' });
  await page.getByLabel('Amount (required)').fill('250');
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: THING })).toBeVisible();
  await expect(page).toHaveURL(/\/cabinet\/items\/\d+$/);
  await page.goto('/shopping?group=supplier');
  await slowExpect(page.getByRole('checkbox', { name: THING })).toBeChecked();
  await page.getByRole('button', { name: 'Clear checked' }).click();
  await slowExpect(page.getByRole('checkbox', { name: THING })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await slowExpect(page.getByRole('checkbox', { name: THING })).toBeChecked();

  // 3. From a jar page, print a label. Add a batch, Medium rectangle, 2 copies each, start at 9: two sheets.
  await page.goto(`/cabinet/items/${jarId}`);
  await slowExpect(page.getByRole('heading', { level: 1, name: JAR })).toBeVisible();
  await page.getByRole('link', { name: 'Print a label' }).click();
  await expect(page).toHaveURL(new RegExp(`/labels\\?items=${jarId}`));
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Labels' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Jars' }).getByRole('checkbox', { name: JAR })).toBeChecked();
  await page.getByRole('group', { name: 'Batches' }).getByRole('checkbox', { name: BATCH }).click();
  await page.getByLabel('Size').selectOption({ label: 'Medium rectangle, 10 per sheet' });
  await page.getByLabel('Start at label').fill('9');
  const jarSetup = page.getByRole('group', { name: `Settings for ${JAR}` });
  const batchSetup = page.getByRole('group', { name: `Settings for ${BATCH}` });
  await slowExpect(jarSetup).toBeVisible();
  await slowExpect(batchSetup).toBeVisible();
  await jarSetup.getByLabel('Copies').fill('2');
  await batchSetup.getByLabel('Copies').fill('2');
  await expect(page.getByTestId('label-page')).toHaveCount(2);
  await expect(page.getByText('Sheet 2 of 2')).toBeVisible();

  // 4. Edit a caution line and save the sheet as a PDF. The toast names the file and Saved PDFs lists it.
  await jarSetup.getByLabel('Caution').fill('Keep away from small children.');
  const before = await page.locator('.label-files a').count();
  await page.getByRole('button', { name: 'Save as PDF' }).click();
  const toast = page.getByText(/^Saved .+\.pdf in your labels folder\.$/);
  await slowExpect(toast).toBeVisible();
  const file = (await toast.textContent()).match(/^Saved (.+\.pdf) in/)[1];
  await slowExpect(page.locator('.label-files a')).toHaveCount(before + 1);
  await expect(page.locator('.label-files').getByRole('link', { name: file })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Labels' })).toBeVisible();
  await page.screenshot({ path: 'test-results/labels.png' });

  // 5. In print, each sheet is exactly one letter page: no screen margin, flex or gap, and labels sit at their slot.
  await page.emulateMedia({ media: 'print' });
  const geometry = await page.evaluate(() => {
    const rect = el => el.getBoundingClientRect();
    const pages = [...document.querySelectorAll('[data-testid="label-page"]')];
    const sheets = document.querySelector('.label-sheets');
    return {
      display: getComputedStyle(sheets).display,
      gap: getComputedStyle(sheets).rowGap,
      previewMargin: getComputedStyle(document.querySelector('.label-preview')).marginTop,
      pages: pages.map(p => ({ top: rect(p).top, left: rect(p).left, width: rect(p).width, height: rect(p).height })),
      cards: pages.map(p => { const c = p.querySelector('[data-testid="label-card"]'); const r = rect(c); const o = rect(p); return { left: r.left - o.left, top: r.top - o.top }; }),
    };
  });
  expect(geometry.display).toBe('block');
  expect(geometry.gap).toBe('normal');
  expect(geometry.previewMargin).toBe('0px');
  expect(geometry.pages).toHaveLength(2);
  expect(geometry.pages[0].width).toBeCloseTo(816, 0);
  // Sheet 2 starts one sheet height below sheet 1 (a new page), and its first label is 0.5in in from the corner.
  expect(geometry.pages[1].top - geometry.pages[0].top).toBeCloseTo(geometry.pages[0].height, 0);
  expect(geometry.cards[1].left).toBeCloseTo(48, 0);
  expect(geometry.cards[1].top).toBeCloseTo(48, 0);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)).toHaveLength(2);
  await page.emulateMedia({ media: 'screen' });

  // Tidy up the jar this run made.
  await request.delete(`/api/items/${jarId}`);
});
