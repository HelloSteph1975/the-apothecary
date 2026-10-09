import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { seedDemo } from '../../server/demo/seed.js';
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
