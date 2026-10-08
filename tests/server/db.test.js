import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { transaction } from '../../server/db/connection.js';
import { migrate, migrations } from '../../server/db/migrations.js';

let t;
afterEach(() => t?.cleanup());

it('creates the data folder layout', () => {
  t = makeTestContext();
  for (const p of ['apothecary.db', 'photos', 'photos/_trash', 'labels', 'backups']) {
    expect(fs.existsSync(path.join(t.dataDir, p)), p).toBe(true);
  }
});

it('runs every migration once and is safe to run again', () => {
  t = makeTestContext();
  expect(t.ctx.db.prepare('PRAGMA user_version').get().user_version).toBe(migrations.length);
  migrate(t.ctx.db);
  expect(t.ctx.db.prepare('PRAGMA user_version').get().user_version).toBe(migrations.length);
});

it('transaction rolls back on error and supports nesting', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  expect(() => transaction(db, () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('a', '1')").run();
    transaction(db, () => db.prepare("INSERT INTO settings (key, value) VALUES ('b', '2')").run());
    throw new Error('boom');
  })).toThrow('boom');
  expect(db.prepare("SELECT COUNT(*) n FROM settings WHERE key IN ('a','b')").get().n).toBe(0);
});
