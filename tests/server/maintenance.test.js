import { it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { makeTestContext } from './helpers.js';
import { migrations } from '../../server/db/migrations.js';
import { restoreBackup } from '../../server/services/backup.js';
import { runMaintenance, grimoireMaintenance } from '../../server/services/maintenance.js';

let t;
afterEach(() => { t?.cleanup(); vi.restoreAllMocks(); });

it('seeds the grimoire and links jars after restoring a backup from before the grimoire', async () => {
  t = makeTestContext();
  const name = 'apothecary-2026-09-01.db';
  const file = path.join(t.dataDir, 'backups', name);
  const old = new DatabaseSync(file);
  old.exec(migrations[0]);
  old.exec(migrations[1]);
  old.exec('PRAGMA user_version = 2');
  const section = old.prepare("SELECT id FROM cabinet_sections WHERE kind = 'herb' ORDER BY id LIMIT 1").get();
  old.prepare('INSERT INTO items (section_id, name, amount, unit) VALUES (?, ?, 10, ?)').run(section.id, 'Calendula', 'g');
  old.close();

  restoreBackup(t.ctx, name);

  const herbs = await t.http().get('/api/herbs');
  expect(herbs.status).toBe(200);
  const list = Array.isArray(herbs.body) ? herbs.body : herbs.body.herbs;
  expect(list).toHaveLength(30);
  const calendula = list.find(h => h.common_name === 'Calendula');
  const jar = t.ctx.db.prepare("SELECT herb_id FROM items WHERE name = 'Calendula'").get();
  expect(jar.herb_id).toBe(calendula.id);
});

it('keeps going when the grimoire seed throws, and skips linking cleanly', () => {
  t = makeTestContext();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const link = vi.fn(() => ({ linked: 0 }));
  expect(() => grimoireMaintenance(t.ctx.db, { seed: () => { throw new Error('bad seed'); }, link })).not.toThrow();
  expect(errors).toHaveBeenCalledWith(expect.stringMatching(/Seeding the grimoire failed/), expect.any(Error));
  expect(link).toHaveBeenCalled();
  expect(t.ctx.db.prepare('SELECT COUNT(*) AS n FROM herbs').get().n).toBe(0);
});

it('runMaintenance still runs every step when the seed throws', () => {
  t = makeTestContext();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => runMaintenance(t.ctx, { seed: () => { throw new Error('bad seed'); } })).not.toThrow();
  expect(errors).toHaveBeenCalledTimes(1);
  expect(fs.readdirSync(path.join(t.dataDir, 'backups')).some(n => n.startsWith('apothecary-'))).toBe(true);
  const linked = t.ctx.db.prepare("SELECT value FROM settings WHERE key LIKE '%link%'").all();
  expect(linked).toHaveLength(0);
});
