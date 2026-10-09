import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The server and the machine can be slow when the whole suite runs, so allow more time than the default 5 seconds.
const slowExpect = expect.configure({ timeout: 15000 });

test('adds a type and a recipe, scales it, and handles delete, undo and type moves', async ({ page }) => {
  test.setTimeout(120000);
  fs.mkdirSync('test-results', { recursive: true });

  // The starter recipe types are there.
  await page.goto('/recipes/types');
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Recipe types' })).toBeVisible();

  // 1. A new type for the skin.
  await page.getByRole('button', { name: 'Add a type' }).click();
  const typeDialog = page.getByRole('dialog');
  await typeDialog.getByLabel('Name').fill('Hair rinse');
  await typeDialog.getByLabel('For the skin').check();
  await typeDialog.getByRole('radio', { name: 'Leaf' }).check();
  await typeDialog.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('button', { name: 'Edit Hair rinse' })).toBeVisible();

  // 2. A recipe of that type.
  await page.goto('/recipes/new');
  await page.getByLabel('Name (required)').fill('Rosemary hair rinse');
  await page.getByLabel('Type (required)').selectOption({ label: 'Hair rinse' });
  await page.getByLabel('Yield amount').fill('250');
  await page.getByLabel('Yield unit').selectOption({ label: 'ml' });
  await page.getByLabel('Steps').fill('Steep the rosemary in hot vinegar.\nStrain and cool before use.');
  await page.getByRole('button', { name: 'Add an ingredient' }).click();
  await page.getByLabel('Ingredient 1 grimoire herb').selectOption({ label: 'Rosemary' });
  await page.getByLabel('Ingredient 1 amount').fill('2');
  await page.getByLabel('Ingredient 1 unit').selectOption({ label: 'tbsp' });
  await page.getByRole('button', { name: 'Add an ingredient' }).click();
  await page.getByLabel('Ingredient 2 name').fill('Apple cider vinegar');
  await page.getByLabel('Ingredient 2 amount').fill('250');
  await page.getByLabel('Ingredient 2 unit').selectOption({ label: 'ml' });
  await page.getByRole('button', { name: 'Save' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Rosemary hair rinse' })).toBeVisible();
  const recipeUrl = page.url();

  // 3. Cautions come before ingredients.
  const before = page.getByRole('heading', { name: 'Before you make it' });
  const ingredients = page.getByRole('heading', { name: 'Ingredients' });
  await slowExpect(before).toBeVisible();
  await slowExpect(ingredients).toBeVisible();
  const [beforeBox, ingBox] = [await before.boundingBox(), await ingredients.boundingBox()];
  slowExpect(beforeBox.y).toBeLessThan(ingBox.y);
  const beforeCard = page.locator('.panel-caution');
  await slowExpect(beforeCard.getByText('Patch test first')).toBeVisible();
  await slowExpect(beforeCard.getByRole('link', { name: 'Rosemary' })).toBeVisible();
  await slowExpect(beforeCard.getByText(/during pregnancy and breastfeeding/)).toBeVisible();
  await slowExpect(page.getByText('Apple cider vinegar')).toBeVisible();
  await page.screenshot({ path: 'test-results/recipe.png', fullPage: true });

  // Scale to 2x.
  await page.getByLabel('Make', { exact: true }).selectOption({ label: '2×' });
  await slowExpect(page.getByText(/Scaled to 2×/)).toBeVisible();
  await slowExpect(page.getByRole('listitem').filter({ hasText: 'Apple cider vinegar' })).toContainText('500 ml');

  // The herb page lists the recipe.
  await page.getByRole('link', { name: 'Rosemary' }).last().click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Rosemary' })).toBeVisible();
  const usedIn = page.locator('.panel').filter({ has: page.getByRole('heading', { name: 'Recipes with this herb' }) });
  await slowExpect(usedIn.getByRole('link', { name: 'Rosemary hair rinse' })).toBeVisible();

  // 4. Delete, then undo.
  await page.goto(recipeUrl);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Recipe book' })).toBeVisible();
  await slowExpect(page.getByRole('link', { name: 'Rosemary hair rinse' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Rosemary hair rinse' })).toBeVisible();

  await page.goto('/recipes');
  await slowExpect(page.getByRole('link', { name: 'Rosemary hair rinse' })).toBeVisible();
  await page.screenshot({ path: 'test-results/recipes.png', fullPage: true });

  // 5. Delete the type; its recipe moves to "other".
  await page.goto('/recipes/types');
  await page.getByRole('button', { name: 'Delete Hair rinse' }).click();
  const moveDialog = page.getByRole('dialog');
  await moveDialog.getByLabel(/Move its 1 recipe to/).selectOption({ label: 'other' });
  await moveDialog.getByRole('button', { name: 'Move and delete' }).click();
  await slowExpect(page.getByRole('button', { name: 'Edit Hair rinse' })).toHaveCount(0);
  await page.goto(recipeUrl);
  await slowExpect(page.getByRole('heading', { level: 1, name: 'Rosemary hair rinse' })).toBeVisible();
  await slowExpect(page.getByText('other, makes 250 ml')).toBeVisible();
});
