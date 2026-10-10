import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { seedDemo } from '../../server/demo/seed.js';
import fs from 'node:fs';
import path from 'node:path';
import { seedGrimoire, linkItemsOnce } from '../../server/services/grimoire.js';
import { getSettings } from '../../server/services/settings.js';

let t;
afterEach(() => t?.cleanup());

it('fills in demo settings once and leaves later edits alone', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  expect(getSettings(t.ctx.db).keeper_name).toBe('Demo Keeper');
  t.ctx.db.prepare("UPDATE settings SET value = 'Changed' WHERE key = 'keeper_name'").run();
  seedDemo(t.ctx);
  expect(getSettings(t.ctx.db).keeper_name).toBe('Changed');
});

it('reset puts the demo settings back', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.prepare("UPDATE settings SET value = 'Changed' WHERE key = 'keeper_name'").run();
  seedDemo(t.ctx, { reset: true });
  expect(getSettings(t.ctx.db).keeper_name).toBe('Demo Keeper');
});

function localToday() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

it('stocks a cabinet with suppliers and something on every Today list', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  const today = localToday();
  const items = (await t.http().get(`/api/items?today=${today}`)).body;
  expect(items.length).toBeGreaterThanOrEqual(12);
  expect(items.map(i => i.name)).toEqual(expect.arrayContaining(['Calendula', 'Mugwort', 'Digital scale']));
  expect((await t.http().get('/api/suppliers')).body).toHaveLength(2);
  const summary = (await t.http().get(`/api/today?today=${today}`)).body;
  expect(summary.runningLow.length).toBeGreaterThanOrEqual(1);
  expect(summary.nearingExpiry.length).toBeGreaterThanOrEqual(1);
  expect(summary.expired.length).toBeGreaterThanOrEqual(1);
});

it('reset restores the demo cabinet without doubling it up', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  const count = async () => (await t.http().get(`/api/items?today=${localToday()}`)).body.length;
  const before = await count();
  t.ctx.db.prepare("UPDATE items SET deleted_at = datetime('now') WHERE name = 'Calendula'").run();
  seedDemo(t.ctx, { reset: true });
  expect(await count()).toBe(before);
  expect((await t.http().get('/api/suppliers')).body).toHaveLength(2);
  expect((await t.http().get('/api/sections')).body).toHaveLength(15);
});

it('stocks the cabinet of an older demo folder that has none, once', async () => {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('demo_seeded', '1')").run();
  expect(seedDemo(t.ctx)).toBe(true);
  const count = async () => (await t.http().get(`/api/items?today=${localToday()}`)).body.length;
  const stocked = await count();
  expect(stocked).toBeGreaterThanOrEqual(12);
  expect(t.ctx.db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get().value).toBe('5');
  expect(seedDemo(t.ctx)).toBe(false);
  expect(await count()).toBe(stocked);
  expect((await t.http().get('/api/suppliers')).body).toHaveLength(2);
});

it('leaves an older demo folder alone when it already has items', async () => {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('demo_seeded', '1')").run();
  await t.http().post('/api/items').send({ section_id: 1, name: 'My own herb', amount: 1, unit: 'g' });
  expect(seedDemo(t.ctx)).toBe(false);
  expect((await t.http().get(`/api/items?today=${localToday()}`)).body).toHaveLength(1);
});

it('reset still works after the Herbs section was renamed, and leaves her name alone', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.prepare("UPDATE cabinet_sections SET name = 'My plants' WHERE name = 'Herbs'").run();
  expect(() => seedDemo(t.ctx, { reset: true })).not.toThrow();
  const names = (await t.http().get(`/api/items?today=${localToday()}`)).body.map(i => i.name);
  expect(names).toEqual(expect.arrayContaining(['Calendula', 'Mugwort']));
  const sections = (await t.http().get('/api/sections')).body;
  expect(sections.map(s => s.name)).toContain('My plants');
  const herbs = sections.filter(s => s.name === 'Herbs');
  expect(herbs).toHaveLength(1);
  expect(herbs[0].kind).toBe('herb');
});

it('reset brings back a deleted starter section instead of adding a copy', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.prepare("UPDATE items SET deleted_at = datetime('now')").run();
  t.ctx.db.prepare("UPDATE cabinet_sections SET deleted_at = datetime('now') WHERE name = 'Waxes'").run();
  seedDemo(t.ctx, { reset: true });
  expect(t.ctx.db.prepare("SELECT COUNT(*) AS n FROM cabinet_sections WHERE name = 'Waxes'").get().n).toBe(1);
  expect(t.ctx.db.prepare("SELECT deleted_at FROM cabinet_sections WHERE name = 'Waxes'").get().deleted_at).toBeNull();
});

it('reset moves demo photo files to the trash', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  const item = t.ctx.db.prepare('SELECT id FROM items LIMIT 1').get();
  const filename = '1700000000000-abcdef12.jpg';
  fs.mkdirSync(path.join(t.dataDir, 'photos', '_trash'), { recursive: true });
  fs.writeFileSync(path.join(t.dataDir, 'photos', filename), 'x');
  t.ctx.db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('item', ?, ?)").run(item.id, filename);
  seedDemo(t.ctx, { reset: true });
  expect(fs.existsSync(path.join(t.dataDir, 'photos', filename))).toBe(false);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', filename))).toBe(true);
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM photos').get().n).toBe(0);
});

const DEMO_HERBS = ['Calendula', 'Chamomile', 'Lavender', 'Mugwort', 'Rose petals'];
const linked = db => db.prepare("SELECT name FROM items WHERE herb_id IS NOT NULL AND deleted_at IS NULL ORDER BY name").all().map(r => r.name);

it('links the demo herbs to the grimoire on a fresh demo, and after a reset', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  expect(linked(t.ctx.db)).toEqual(DEMO_HERBS);
  // Startup maintenance runs after the seed; it must not undo anything.
  seedGrimoire(t.ctx.db);
  linkItemsOnce(t.ctx.db);
  expect(linked(t.ctx.db)).toEqual(DEMO_HERBS);
  t.ctx.db.prepare('UPDATE items SET herb_id = NULL').run();
  seedDemo(t.ctx, { reset: true });
  expect(linked(t.ctx.db)).toEqual(DEMO_HERBS);
  expect(t.ctx.db.prepare("SELECT h.slug FROM items i JOIN herbs h ON h.id = i.herb_id WHERE i.name = 'Rose petals'").get().slug).toBeTruthy();
});

it('links the demo herbs of an existing v2 demo folder', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.prepare('UPDATE items SET herb_id = NULL').run();
  t.ctx.db.prepare("UPDATE settings SET value = '2' WHERE key = 'demo_seeded'").run();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('grimoire_link_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
  expect(seedDemo(t.ctx)).toBe(false);
  expect(linked(t.ctx.db)).toEqual(DEMO_HERBS);
  expect(seedDemo(t.ctx)).toBe(false);
});

const recipeNames = db => db.prepare('SELECT name FROM recipes WHERE deleted_at IS NULL ORDER BY name').all().map(r => r.name);
const DEMO_RECIPES = ['Calendula skin salve', 'Rose face serum', 'Sleepy chamomile tea'];

it('adds three demo recipes linked to grimoire herbs', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  expect(recipeNames(t.ctx.db)).toEqual(DEMO_RECIPES);
  const links = t.ctx.db.prepare(`SELECT r.name AS recipe, h.slug FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id JOIN herbs h ON h.id = ri.herb_id WHERE ri.deleted_at IS NULL ORDER BY r.name, h.slug`).all();
  expect(links).toEqual([
    { recipe: 'Calendula skin salve', slug: 'calendula' },
    { recipe: 'Rose face serum', slug: 'rose' },
    { recipe: 'Sleepy chamomile tea', slug: 'chamomile' },
    { recipe: 'Sleepy chamomile tea', slug: 'lavender' },
    { recipe: 'Sleepy chamomile tea', slug: 'lemon-balm' },
  ]);
  const salve = t.ctx.db.prepare("SELECT id FROM recipes WHERE name = 'Calendula skin salve'").get();
  const detail = (await t.http().get(`/api/recipes/${salve.id}`)).body;
  expect(detail.needs_patch_test).toBe(true);
  expect(detail.steps).toBeTruthy();
  const herb = t.ctx.db.prepare("SELECT id FROM herbs WHERE slug = 'calendula'").get();
  expect((await t.http().get(`/api/herbs/${herb.id}`)).body.recipes.map(x => x.name)).toEqual(['Calendula skin salve']);
});

it('running the demo seed again changes nothing', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  expect(seedDemo(t.ctx)).toBe(false);
  expect(recipeNames(t.ctx.db)).toEqual(DEMO_RECIPES);
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM recipes').get().n).toBe(3);
});

it('gives an existing v3 demo folder the recipes once', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.exec('DELETE FROM batch_steps; DELETE FROM batch_ingredients; DELETE FROM batches; DELETE FROM recipe_ingredients; DELETE FROM recipes');
  t.ctx.db.prepare("UPDATE settings SET value = '3' WHERE key = 'demo_seeded'").run();
  expect(seedDemo(t.ctx)).toBe(false);
  expect(recipeNames(t.ctx.db)).toEqual(DEMO_RECIPES);
  expect(t.ctx.db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get().value).toBe('5');
  t.ctx.db.exec('DELETE FROM batch_steps; DELETE FROM batch_ingredients; DELETE FROM batches; DELETE FROM recipe_ingredients; DELETE FROM recipes');
  seedDemo(t.ctx);
  expect(recipeNames(t.ctx.db)).toEqual([]);
});

it('reset re-adds the demo recipes, trashes their photos and leaves recipe types alone', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  const recipe = t.ctx.db.prepare('SELECT id FROM recipes LIMIT 1').get();
  const filename = '1700000000001-abcdef12.jpg';
  fs.mkdirSync(path.join(t.dataDir, 'photos', '_trash'), { recursive: true });
  fs.writeFileSync(path.join(t.dataDir, 'photos', filename), 'x');
  t.ctx.db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('recipe', ?, ?)").run(recipe.id, filename);
  t.ctx.db.prepare("UPDATE recipe_types SET name = 'my salve' WHERE slug = 'salve'").run();
  const types = () => t.ctx.db.prepare('SELECT COUNT(*) AS n FROM recipe_types').get().n;
  const before = types();
  seedDemo(t.ctx, { reset: true });
  expect(recipeNames(t.ctx.db)).toEqual(DEMO_RECIPES);
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM recipes').get().n).toBe(3);
  expect(types()).toBe(before);
  expect(t.ctx.db.prepare("SELECT name FROM recipe_types WHERE slug = 'salve'").get().name).toBe('my salve');
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', filename))).toBe(true);
  expect(t.ctx.db.prepare("SELECT COUNT(*) AS n FROM photos WHERE owner_type = 'recipe'").get().n).toBe(0);
});

it('reset skips a demo recipe whose starter type she deleted', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.exec('DELETE FROM batch_steps; DELETE FROM batch_ingredients; DELETE FROM batches');
  t.ctx.db.exec("DELETE FROM recipe_ingredients WHERE recipe_id IN (SELECT r.id FROM recipes r JOIN recipe_types y ON y.id = r.type_id WHERE y.slug = 'serum')");
  t.ctx.db.exec("DELETE FROM recipes WHERE type_id = (SELECT id FROM recipe_types WHERE slug = 'serum')");
  t.ctx.db.prepare("UPDATE recipe_types SET deleted_at = ? WHERE slug = 'serum'").run(new Date().toISOString());
  expect(() => seedDemo(t.ctx, { reset: true })).not.toThrow();
  expect(recipeNames(t.ctx.db)).toEqual(['Calendula skin salve', 'Sleepy chamomile tea']);
});

const batchNames = db => db.prepare('SELECT name FROM batches WHERE deleted_at IS NULL ORDER BY name').all().map(r => r.name);
const DEMO_BATCHES = ['Calendula skin salve', 'Sleepy chamomile tea'];
const clearBatchRows = db => db.exec('DELETE FROM batch_steps; DELETE FROM batch_ingredients; DELETE FROM batches');

it('adds a steeping batch and a finished batch with its made jar', async () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  expect(batchNames(t.ctx.db)).toEqual(DEMO_BATCHES);
  const salve = t.ctx.db.prepare("SELECT id FROM batches WHERE name = 'Calendula skin salve'").get();
  const steeping = (await t.http().get(`/api/batches/${salve.id}`)).body;
  expect(steeping.status).toBe('steeping');
  expect(steeping.recipe.name).toBe('Calendula skin salve');
  expect(steeping.steps.map(s => s.title)).toEqual(['Strain and bottle']);
  const tea = t.ctx.db.prepare("SELECT id FROM batches WHERE name = 'Sleepy chamomile tea'").get();
  const done = (await t.http().get(`/api/batches/${tea.id}`)).body;
  expect(done.status).toBe('finished');
  expect(done.made_item.name).toBe('Sleepy chamomile tea');
  // The draw came out of the demo jar through the batch service.
  expect(t.ctx.db.prepare("SELECT amount FROM items WHERE name = 'Calendula'").get().amount).toBe(20);
});

it('gives an existing v4 demo folder the batches once', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  clearBatchRows(t.ctx.db);
  t.ctx.db.prepare("UPDATE settings SET value = '4' WHERE key = 'demo_seeded'").run();
  expect(seedDemo(t.ctx)).toBe(false);
  expect(batchNames(t.ctx.db)).toEqual(DEMO_BATCHES);
  expect(t.ctx.db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get().value).toBe('5');
  clearBatchRows(t.ctx.db);
  seedDemo(t.ctx);
  expect(batchNames(t.ctx.db)).toEqual([]);
});

it('still seeds the batches when a demo jar holds less than the batch draws', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  clearBatchRows(t.ctx.db);
  t.ctx.db.prepare("UPDATE items SET amount = 2 WHERE name = 'Calendula'").run();
  t.ctx.db.prepare("UPDATE settings SET value = '4' WHERE key = 'demo_seeded'").run();
  expect(() => seedDemo(t.ctx)).not.toThrow();
  expect(batchNames(t.ctx.db)).toEqual(DEMO_BATCHES);
  expect(t.ctx.db.prepare("SELECT amount FROM items WHERE name = 'Calendula'").get().amount).toBe(0);
});

it('draws the demo grams in the jar unit, so a kilogram jar loses 0.01 kg', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  clearBatchRows(t.ctx.db);
  t.ctx.db.prepare("UPDATE items SET amount = 0.5, unit = 'kg' WHERE name = 'Calendula'").run();
  t.ctx.db.prepare("UPDATE settings SET value = '4' WHERE key = 'demo_seeded'").run();
  seedDemo(t.ctx);
  expect(t.ctx.db.prepare("SELECT amount FROM items WHERE name = 'Calendula'").get().amount).toBe(0.49);
  const line = t.ctx.db.prepare("SELECT drawn_amount, drawn_unit FROM batch_ingredients WHERE name = 'Calendula'").get();
  expect(line).toEqual({ drawn_amount: 0.01, drawn_unit: 'kg' });
});

it('does not draw from a demo jar whose unit cannot be converted from grams', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  clearBatchRows(t.ctx.db);
  t.ctx.db.prepare("UPDATE items SET amount = 5, unit = 'count' WHERE name = 'Calendula'").run();
  t.ctx.db.prepare("UPDATE settings SET value = '4' WHERE key = 'demo_seeded'").run();
  seedDemo(t.ctx);
  expect(t.ctx.db.prepare("SELECT amount FROM items WHERE name = 'Calendula'").get().amount).toBe(5);
  expect(t.ctx.db.prepare("SELECT item_id FROM batch_ingredients WHERE name = 'Calendula'").get().item_id).toBeNull();
});

it('leaves a v4 demo folder alone when it already has a batch', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.exec("DELETE FROM batch_steps; DELETE FROM batch_ingredients; DELETE FROM batches WHERE name = 'Sleepy chamomile tea'");
  t.ctx.db.prepare("UPDATE settings SET value = '4' WHERE key = 'demo_seeded'").run();
  seedDemo(t.ctx);
  expect(batchNames(t.ctx.db)).toEqual(['Calendula skin salve']);
});

it('reset clears and re-adds the demo batches, trashes their photos and does not double up', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  const batch = t.ctx.db.prepare('SELECT id FROM batches LIMIT 1').get();
  const filename = '1700000000002-abcdef12.jpg';
  fs.mkdirSync(path.join(t.dataDir, 'photos', '_trash'), { recursive: true });
  fs.writeFileSync(path.join(t.dataDir, 'photos', filename), 'x');
  t.ctx.db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('batch', ?, ?)").run(batch.id, filename);
  seedDemo(t.ctx, { reset: true });
  seedDemo(t.ctx, { reset: true });
  expect(batchNames(t.ctx.db)).toEqual(DEMO_BATCHES);
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM batches').get().n).toBe(2);
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM recipes').get().n).toBe(3);
  expect(t.ctx.db.prepare("SELECT amount FROM items WHERE name = 'Calendula'").get().amount).toBe(20);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', filename))).toBe(true);
  expect(t.ctx.db.prepare("SELECT COUNT(*) AS n FROM photos WHERE owner_type = 'batch'").get().n).toBe(0);
});
