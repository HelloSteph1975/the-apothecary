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
  expect(t.ctx.db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get().value).toBe('3');
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
