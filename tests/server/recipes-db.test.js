import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { migrations } from '../../server/db/migrations.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';
import { restoreBackup } from '../../server/services/backup.js';
import { getSettings } from '../../server/services/settings.js';
import { RECIPE_ICONS } from '../../server/schemas.js';
import { seedRecipeTypes, loadStarterTypes, RECIPE_TYPES_SEED_VERSION } from '../../server/services/recipeTypes.js';

let t;
afterEach(() => t?.cleanup());

const TOPICAL = ['salve', 'balm', 'serum', 'face oil', 'lotion', 'ritual oil'];

it('migration 4 creates the recipe tables', () => {
  t = makeTestContext();
  const names = t.ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  expect(names).toEqual(expect.arrayContaining(['recipe_types', 'recipes', 'recipe_ingredients']));
});

it('the starter types file has 22 entries with unique slugs, known icons, plain dashes and the six topical types', () => {
  const entries = loadStarterTypes();
  expect(entries).toHaveLength(22);
  expect(entries[0].name).toBe('tincture');
  expect(entries.at(-1).name).toBe('other');
  const slugs = entries.map(e => e.slug);
  expect(new Set(slugs).size).toBe(22);
  for (const e of entries) {
    expect(e.slug).toBe(e.name.replace(/ /g, '-'));
    expect(RECIPE_ICONS).toContain(e.icon);
  }
  const text = fs.readFileSync(path.join(import.meta.dirname, '../../server/data/recipe-types.json'), 'utf8');
  expect(text).not.toMatch(/[–—]/);
  expect(entries.filter(e => e.is_topical === 1).map(e => e.name).sort()).toEqual([...TOPICAL].sort());
});

it('seeds 22 types in order as starters, once', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  expect(seedRecipeTypes(db)).toEqual({ added: 22 });
  const types = repos(db).recipeTypes.list();
  expect(types.map(x => x.name)).toEqual(loadStarterTypes().map(e => e.name));
  expect(types.every(x => x.is_starter === 1)).toBe(true);
  expect(types.map(x => x.sort_order)).toEqual([...Array(22).keys()]);
  const tincture = types[0];
  expect(tincture).toMatchObject({ slug: 'tincture', wait_days: 42, shelf_life_days: 1095, is_topical: 0, icon: 'flask' });
  expect(types.find(x => x.slug === 'other')).toMatchObject({ wait_days: null, shelf_life_days: null, label_caution: null });
  expect(seedRecipeTypes(db)).toEqual({ added: 0 });
  expect(repos(db).recipeTypes.list()).toHaveLength(22);
  const marker = db.prepare("SELECT value FROM settings WHERE key = 'recipe_types_seed_version'").get();
  expect(Number(marker.value)).toBe(RECIPE_TYPES_SEED_VERSION);
  expect(getSettings(db)).not.toHaveProperty('recipe_types_seed_version');
});

it('does not re-add a deleted starter or overwrite an edited one', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  seedRecipeTypes(db);
  const r = repos(db).recipeTypes;
  const salve = r.list().find(x => x.slug === 'salve');
  const moon = r.list().find(x => x.slug === 'moon-water');
  r.update(salve.id, { description: 'My salve words.' });
  r.remove(moon.id);
  db.prepare("DELETE FROM settings WHERE key = 'recipe_types_seed_version'").run();
  expect(seedRecipeTypes(db)).toEqual({ added: 0 });
  expect(r.get(salve.id).description).toBe('My salve words.');
  expect(r.list()).toHaveLength(21);
});

it('PHOTO_OWNERS knows recipes', () => {
  expect(PHOTO_OWNERS.recipe).toBe('recipes');
});

it('restoring a backup from before recipes gives the 22 starter types', () => {
  t = makeTestContext();
  const name = 'apothecary-2026-10-01.db';
  const old = new DatabaseSync(path.join(t.dataDir, 'backups', name));
  for (const m of migrations.slice(0, 3)) old.exec(m);
  old.exec('PRAGMA user_version = 3');
  old.close();
  restoreBackup(t.ctx, name);
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM recipe_types WHERE deleted_at IS NULL').get().n).toBe(22);
});
