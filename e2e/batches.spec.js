import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });

// The date the client shows for something due in this many days, e.g. "Nov 6".
const dueIn = days => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

test('makes a recipe into a batch, finishes it and prints the record sheet', async ({ page }) => {
  test.setTimeout(150000);
  fs.mkdirSync('test-results', { recursive: true });

  // 1. A calendula jar and a recipe that uses it.
  await page.goto('/cabinet/new');
  await page.getByLabel('Section (required)').selectOption({ label: 'Herbs' });
  await page.getByLabel('Grimoire herb').selectOption({ label: 'Calendula' });
  await page.getByLabel('Name (required)').fill('Batch test calendula');
  await page.getByLabel('Amount (required)').fill('50');
  await page.getByLabel('Unit').selectOption({ label: 'g' });
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Batch test calendula' })).toBeVisible();
  const jarUrl = page.url();

  await page.goto('/recipes/new');
  await page.getByLabel('Name (required)').fill('Batch test oil');
  await page.getByLabel('Type (required)').selectOption({ label: 'infused oil' });
  await page.getByLabel('Yield amount').fill('200');
  await page.getByLabel('Yield unit').selectOption({ label: 'ml' });
  await page.getByLabel('Steps').fill('Cover the calendula with oil.\nLeave it to steep, then strain.');
  await page.getByRole('button', { name: 'Add an ingredient' }).click();
  await page.getByLabel('Ingredient 1 grimoire herb').selectOption({ label: 'Calendula' });
  await page.getByLabel('Ingredient 1 amount').fill('30');
  await page.getByLabel('Ingredient 1 unit').selectOption({ label: 'g' });
  await page.getByRole('button', { name: 'Add an ingredient' }).click();
  await page.getByLabel('Ingredient 2 name').fill('Olive oil');
  await page.getByLabel('Ingredient 2 amount').fill('200');
  await page.getByLabel('Ingredient 2 unit').selectOption({ label: 'ml' });
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Batch test oil' })).toBeVisible();

  // 2. Make it at Double: the jar holds 50 g and the recipe now wants 60 g.
  await page.getByLabel('Make', { exact: true }).selectOption({ label: 'Double' });
  await slowExpect(page.getByText(/Scaled to 2×/)).toBeVisible();
  await page.getByRole('link', { name: 'Make this recipe' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Start a batch' })).toBeVisible();
  const calendula = page.getByRole('group', { name: /Calendula/ });
  await slowExpect(calendula.getByText('This jar holds only 50 g.')).toBeVisible();
  await expect(calendula.getByLabel('Amount to draw')).toHaveValue('60');
  const oil = page.getByRole('group', { name: /Olive oil/ });
  await slowExpect(oil.getByText('No jar in the cabinet matches. You can still make it.')).toBeVisible();

  // 3. Save: the short-stock dialog asks first.
  await page.getByRole('button', { name: 'Start batch' }).click();
  const short = page.getByRole('dialog', { name: 'Some jars are running short' });
  await slowExpect(short).toBeVisible();
  await expect(short.getByText(/Batch test calendula: has 50 g, drawing 60 g/)).toBeVisible();
  await short.getByRole('button', { name: /Use what's there/ }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: /Batch test oil/ })).toBeVisible();
  await slowExpect(page.getByText('Strain and bottle')).toBeVisible();
  await expect(page.getByText(`due ${dueIn(28)}`)).toBeVisible();
  const batchUrl = page.url();
  await page.screenshot({ path: 'test-results/batch.png', fullPage: true });

  // The jar is used up.
  await page.goto(jarUrl);
  await slowExpect(page.getByText(/used up/i).first()).toBeVisible();

  // 4. Check the step done, then finish and add a new jar.
  await page.goto(batchUrl);
  await page.getByLabel('Done').click();
  await slowExpect(page.getByLabel('Done')).toBeChecked();
  await page.getByRole('button', { name: 'Finish this batch' }).click();
  const finish = page.getByRole('dialog', { name: 'Finish this batch' });
  await slowExpect(finish).toBeVisible();
  await finish.getByLabel('Name', { exact: true }).fill('Batch test oil');
  await finish.getByLabel('Section').selectOption({ label: 'Oils and butters' });
  await finish.getByLabel('Amount', { exact: true }).fill('400');
  await finish.getByLabel('Unit', { exact: true }).selectOption({ label: 'ml' });
  await finish.getByRole('button', { name: 'Finish' }).click();
  const jarLink = page.getByRole('link', { name: 'Batch test oil' }).last();
  await slowExpect(page.getByRole('heading', { name: 'Finished', exact: true })).toBeVisible();
  await expect(jarLink).toBeVisible();
  await jarLink.click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Batch test oil' })).toBeVisible();
  await page.goto(batchUrl);

  // 5. The record sheet has every label. Screenshot it as it prints.
  await page.getByRole('link', { name: 'Print record sheet' }).click();
  const sheet = page.getByTestId('record-sheet');
  await slowExpect(sheet).toBeVisible();
  for (const label of ['Date', 'Recipe', 'Preparation type', 'Herbs used', 'Base', 'Why I made it', 'How I prepared it',
    'What I noticed', 'What I would change', 'Label and shelf-life notes']) {
    await expect(sheet.getByRole('heading', { name: label, exact: true })).toBeVisible();
  }
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'test-results/sheet.png', fullPage: true });
  await page.emulateMedia({ media: 'screen' });

  // The journal lists the batch.
  await page.goto('/batches?status=finished');
  await slowExpect(page.getByRole('link', { name: /Batch test oil/ }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/batches.png', fullPage: true });

  // 6. Delete the batch, then undo.
  await page.goto(batchUrl);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  const undo = page.getByRole('button', { name: 'Undo' });
  await slowExpect(undo).toBeVisible();
  await undo.click();
  await slowExpect(page.getByRole('heading', { level: 1, name: /Batch test oil/ })).toBeVisible();
});
