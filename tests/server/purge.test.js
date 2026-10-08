import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { backupNow } from '../../server/services/backup.js';
import { purgeSoftDeleted, purgeTrash } from '../../server/services/purge.js';

let t;
afterEach(() => t?.cleanup());

it('purges photo rows deleted over 30 days ago and their files', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const recent = new Date().toISOString();
  db.prepare("INSERT INTO photos (owner_type, owner_id, filename, deleted_at) VALUES ('herb', 1, '1-aaaaaaaa.jpg', ?)").run(old);
  db.prepare("INSERT INTO photos (owner_type, owner_id, filename, deleted_at) VALUES ('herb', 1, '2-bbbbbbbb.jpg', ?)").run(recent);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '_trash', '1-aaaaaaaa.jpg'), 'x');
  expect(purgeSoftDeleted(db, t.dataDir).photos).toBe(1);
  expect(db.prepare('SELECT filename FROM photos').all().map(r => r.filename)).toEqual(['2-bbbbbbbb.jpg']);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', '1-aaaaaaaa.jpg'))).toBe(false);
});

it('purgeTrash removes old trash files only', () => {
  t = makeTestContext();
  const trash = path.join(t.dataDir, 'photos', '_trash');
  fs.writeFileSync(path.join(trash, 'old.jpg'), 'x');
  fs.writeFileSync(path.join(trash, 'new.jpg'), 'x');
  const old = new Date(Date.now() - 40 * 86400000);
  fs.utimesSync(path.join(trash, 'old.jpg'), old, old);
  purgeTrash(t.dataDir, 30);
  expect(fs.readdirSync(trash)).toEqual(['new.jpg']);
});

it('purges old items, suppliers and sections with their dependents', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const id = r => Number(r.lastInsertRowid);
  const sec = id(run("INSERT INTO cabinet_sections (name) VALUES ('Old shelf')"));
  const gone = id(run("INSERT INTO items (section_id, name, amount, unit) VALUES (1, 'Gone', 1, 'g')"));
  const live = id(run("INSERT INTO items (section_id, name, amount, unit) VALUES (1, 'Live', 1, 'g')"));
  const sup = id(run("INSERT INTO suppliers (name) VALUES ('Moonvale')"));
  const pGone = id(run("INSERT INTO purchases (item_id, purchased_on, quantity, unit) VALUES (?, '2026-01-01', 1, 'g')", gone));
  const pLive = id(run("INSERT INTO purchases (item_id, supplier_id, purchased_on, quantity, unit) VALUES (?, ?, '2026-01-01', 1, 'g')", live, sup));
  run("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('item', ?, '1-aaaaaaaa.jpg')", gone);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '1-aaaaaaaa.jpg'), 'x');
  run('UPDATE items SET deleted_at = ? WHERE id = ?', old, gone);
  run('UPDATE suppliers SET deleted_at = ? WHERE id = ?', old, sup);
  run('UPDATE cabinet_sections SET deleted_at = ? WHERE id = ?', old, sec);

  const counts = purgeSoftDeleted(db, t.dataDir);
  expect(counts).toMatchObject({ photos: 1, items: 1, suppliers: 1, cabinet_sections: 1 });
  expect(db.prepare('SELECT COUNT(*) n FROM photos').get().n).toBe(0);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '1-aaaaaaaa.jpg'))).toBe(false);
  expect(db.prepare('SELECT id FROM purchases WHERE id = ?').get(pGone)).toBeUndefined();
  expect(db.prepare('SELECT supplier_id FROM purchases WHERE id = ?').get(pLive).supplier_id).toBeNull();
  expect(db.prepare('SELECT id FROM suppliers WHERE id = ?').get(sup)).toBeUndefined();
});

it('keeps a deleted section while a deleted-but-unpurged item still sits in it', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const recent = new Date().toISOString();
  const sec = Number(db.prepare("INSERT INTO cabinet_sections (name) VALUES ('Old shelf')").run().lastInsertRowid);
  db.prepare("INSERT INTO items (section_id, name, amount, unit, deleted_at) VALUES (?, 'Recent', 1, 'g', ?)").run(sec, recent);
  db.prepare('UPDATE cabinet_sections SET deleted_at = ? WHERE id = ?').run(old, sec);
  expect(purgeSoftDeleted(db, t.dataDir).cabinet_sections).toBe(0);
  expect(db.prepare('SELECT id FROM cabinet_sections WHERE id = ?').get(sec)).toBeDefined();
});

it('keeps the file of a purged item photo that a kept backup still needs', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const item = Number(db.prepare("INSERT INTO items (section_id, name, amount, unit) VALUES (1, 'Gone', 1, 'g')").run().lastInsertRowid);
  db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('item', ?, '3-cccccccc.jpg')").run(item);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '3-cccccccc.jpg'), 'x');
  backupNow(db, t.dataDir);
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  db.prepare('UPDATE items SET deleted_at = ? WHERE id = ?').run(old, item);
  expect(purgeSoftDeleted(db, t.dataDir).photos).toBe(1);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', '3-cccccccc.jpg'))).toBe(true);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '3-cccccccc.jpg'))).toBe(false);
});
