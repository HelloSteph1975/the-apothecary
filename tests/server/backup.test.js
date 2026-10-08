import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { makeTestContext } from './helpers.js';
import { migrations } from '../../server/db/migrations.js';
import { backupNow, listBackups, rotateBackups, ensureRecentBackup, restoreBackup } from '../../server/services/backup.js';

let t;
afterEach(() => t?.cleanup());

it('backs up, lists and rotates (keeping at least 5)', () => {
  t = makeTestContext();
  const dir = path.join(t.dataDir, 'backups');
  for (let d = 1; d <= 8; d++) {
    const name = `apothecary-2026-08-0${d}.db`;
    fs.writeFileSync(path.join(dir, name), 'x');
    const when = new Date(`2026-08-0${d}T21:30:00`);
    fs.utimesSync(path.join(dir, name), when, when);
  }
  const { name } = backupNow(t.ctx.db, t.dataDir, new Date('2026-10-07T21:30:00'));
  expect(name).toBe('apothecary-2026-10-07.db');
  const removed = rotateBackups(t.dataDir, { now: Date.parse('2026-10-07T22:00:00') });
  expect(removed).toHaveLength(4);
  expect(listBackups(t.dataDir).map(b => b.name)[0]).toBe('apothecary-2026-10-07.db');
  expect(listBackups(t.dataDir)).toHaveLength(5);
});

it('makes a startup backup only when the newest is over a day old', () => {
  t = makeTestContext();
  expect(ensureRecentBackup(t.ctx.db, t.dataDir, new Date('2026-10-07T06:00:00'))).toBe(true);
  expect(ensureRecentBackup(t.ctx.db, t.dataDir, new Date('2026-10-07T07:00:00'))).toBe(false);
});

it('restores a backup and keeps a safety copy', () => {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('marker_Before', 'Before')").run();
  const { name } = backupNow(t.ctx.db, t.dataDir);
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('marker_After', 'After')").run();
  const r = restoreBackup(t.ctx, name);
  const names = t.ctx.db.prepare("SELECT value AS name FROM settings WHERE key LIKE 'marker_%'").all().map(s => s.name);
  expect(names).toContain('Before');
  expect(names).not.toContain('After');
  expect(r.safetyCopy).toMatch(/^pre-restore-/);
  expect(() => restoreBackup(t.ctx, '../apothecary.db')).toThrow();
  const safety = new DatabaseSync(path.join(t.dataDir, 'backups', r.safetyCopy));
  expect(safety.prepare("SELECT value AS name FROM settings WHERE key LIKE 'marker_%'").all().map(s => s.name)).toContain('After');
  safety.close();
  expect(fs.existsSync(path.join(t.dataDir, 'apothecary.db.restore-tmp'))).toBe(false);
});

it('refuses a damaged backup and leaves live data alone', () => {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('marker_Keep', 'Keep')").run();
  fs.writeFileSync(path.join(t.dataDir, 'backups', 'apothecary-2026-01-01.db'), 'not a db');
  expect(() => restoreBackup(t.ctx, 'apothecary-2026-01-01.db')).toThrow(/damaged/);
  expect(t.ctx.db.prepare("SELECT value AS name FROM settings WHERE key LIKE 'marker_%'").all().map(s => s.name)).toContain('Keep');
  expect(fs.existsSync(path.join(t.dataDir, 'apothecary.db.restore-tmp'))).toBe(false);
});

function expectForeignRefused(version, setup) {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('marker_Keep', 'Keep')").run();
  const file = path.join(t.dataDir, 'backups', 'apothecary-2026-01-02.db');
  const other = new DatabaseSync(file);
  other.exec(setup);
  other.exec(`PRAGMA user_version = ${version}`);
  other.close();
  expect(() => restoreBackup(t.ctx, 'apothecary-2026-01-02.db')).toThrow(/isn't an Apothecary backup/);
  expect(t.ctx.db.prepare("SELECT value AS name FROM settings WHERE key LIKE 'marker_%'").all().map(s => s.name)).toContain('Keep');
  expect(fs.existsSync(path.join(t.dataDir, 'apothecary.db.restore-tmp'))).toBe(false);
}

it('refuses an unrelated SQLite file and leaves live data alone', () => {
  expectForeignRefused(1, 'CREATE TABLE other(x)');
});

it('refuses a backup from a newer version of the app', () => {
  expectForeignRefused(migrations.length + 1, 'CREATE TABLE settings(key, value); CREATE TABLE photos(id)');
});

it('puts data back from the safety copy when reopen fails after the swap', () => {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('marker_Before', 'Before')").run();
  const { name } = backupNow(t.ctx.db, t.dataDir);
  t.ctx.db.prepare("INSERT INTO settings (key, value) VALUES ('marker_After', 'After')").run();
  const original = t.ctx.reopen;
  let calls = 0;
  t.ctx.reopen = () => { if (calls++ === 0) throw new Error('boom'); return original(); };
  expect(() => restoreBackup(t.ctx, name)).toThrow('Restore failed; your data was put back from the safety copy.');
  t.ctx.reopen = original;
  const names = t.ctx.db.prepare("SELECT value AS name FROM settings WHERE key LIKE 'marker_%'").all().map(s => s.name);
  expect(names).toContain('After');
});
