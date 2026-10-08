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
