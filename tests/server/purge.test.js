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

it('purges old herbs with their photos and sources, and unlinks their jars', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const recent = new Date().toISOString();
  const run = (sql, ...a) => Number(db.prepare(sql).run(...a).lastInsertRowid);
  const gone = run("INSERT INTO herbs (common_name, deleted_at) VALUES ('Gone', ?)", old);
  const kept = run("INSERT INTO herbs (common_name) VALUES ('Kept')");
  const fresh = run("INSERT INTO herbs (common_name, deleted_at) VALUES ('Fresh', ?)", recent);
  run("INSERT INTO herb_sources (herb_id, title) VALUES (?, 'of gone')", gone);
  run("INSERT INTO herb_sources (herb_id, title, deleted_at) VALUES (?, 'replaced', ?)", kept, old);
  run("INSERT INTO herb_sources (herb_id, title) VALUES (?, 'live')", kept);
  run("INSERT INTO herb_sources (herb_id, title) VALUES (?, 'of fresh')", fresh);
  run("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('herb', ?, '5-eeeeeeee.jpg')", gone);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '5-eeeeeeee.jpg'), 'x');
  const jar = run("INSERT INTO items (section_id, name, amount, unit, herb_id) VALUES (1, 'Jar', 1, 'g', ?)", gone);
  const jar2 = run("INSERT INTO items (section_id, name, amount, unit, herb_id) VALUES (1, 'Jar 2', 1, 'g', ?)", kept);

  const counts = purgeSoftDeleted(db, t.dataDir);
  expect(counts.herbs).toBe(1);
  expect(counts.photos).toBe(1);
  expect(db.prepare('SELECT title FROM herb_sources ORDER BY id').all().map(r => r.title)).toEqual(['live', 'of fresh']);
  expect(db.prepare('SELECT id FROM herbs ORDER BY id').all().map(r => r.id)).toEqual([kept, fresh]);
  expect(db.prepare('SELECT herb_id FROM items WHERE id = ?').get(jar).herb_id).toBeNull();
  expect(db.prepare('SELECT herb_id FROM items WHERE id = ?').get(jar2).herb_id).toBe(kept);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '5-eeeeeeee.jpg'))).toBe(false);
});

it('purges old recipes with their ingredients and photos, unlinks purged herbs, and keeps a type still in use', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const recent = new Date().toISOString();
  const run = (sql, ...a) => Number(db.prepare(sql).run(...a).lastInsertRowid);
  const usedType = run("INSERT INTO recipe_types (name, deleted_at) VALUES ('Used', ?)", old);
  const freeType = run("INSERT INTO recipe_types (name, deleted_at) VALUES ('Free', ?)", old);
  const liveType = run("INSERT INTO recipe_types (name) VALUES ('Live')");
  const herbGone = run("INSERT INTO herbs (common_name, deleted_at) VALUES ('Gone herb', ?)", old);
  const gone = run('INSERT INTO recipes (name, type_id, deleted_at) VALUES (?, ?, ?)', 'Old salve', liveType, old);
  const fresh = run('INSERT INTO recipes (name, type_id, deleted_at) VALUES (?, ?, ?)', 'Fresh tea', usedType, recent);
  const kept = run('INSERT INTO recipes (name, type_id) VALUES (?, ?)', 'Kept oil', liveType);
  run("INSERT INTO recipe_ingredients (recipe_id, name) VALUES (?, 'of gone')", gone);
  run("INSERT INTO recipe_ingredients (recipe_id, name, deleted_at) VALUES (?, 'replaced', ?)", kept, old);
  const linked = run("INSERT INTO recipe_ingredients (recipe_id, herb_id, name) VALUES (?, ?, 'Gone herb')", kept, herbGone);
  run("INSERT INTO recipe_ingredients (recipe_id, name) VALUES (?, 'of fresh')", fresh);
  run("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('recipe', ?, '6-ffffffff.jpg')", gone);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '6-ffffffff.jpg'), 'x');

  const counts = purgeSoftDeleted(db, t.dataDir);
  expect(counts).toMatchObject({ photos: 1, recipes: 1, recipe_types: 1, herbs: 1 });
  expect(db.prepare('SELECT id FROM recipes ORDER BY id').all().map(r => r.id)).toEqual([fresh, kept]);
  expect(db.prepare('SELECT name FROM recipe_ingredients ORDER BY id').all().map(r => r.name)).toEqual(['Gone herb', 'of fresh']);
  expect(db.prepare('SELECT herb_id, name FROM recipe_ingredients WHERE id = ?').get(linked)).toEqual({ herb_id: null, name: 'Gone herb' });
  expect(db.prepare('SELECT herb_gone FROM recipe_ingredients WHERE id = ?').get(linked).herb_gone).toBe(1);
  expect(db.prepare('SELECT id FROM recipe_types ORDER BY id').all().map(r => r.id)).toEqual([usedType, liveType]);
  expect(db.prepare('SELECT id FROM recipe_types WHERE id = ?').get(freeType)).toBeUndefined();
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '6-ffffffff.jpg'))).toBe(false);
});

it('purges old batches with lines, steps and photos, unlinks purged items and recipes, and keeps a type a batch uses', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const run = (sql, ...a) => Number(db.prepare(sql).run(...a).lastInsertRowid);
  const batchType = run("INSERT INTO recipe_types (name, deleted_at) VALUES ('Batch only', ?)", old);
  const freeType = run("INSERT INTO recipe_types (name, deleted_at) VALUES ('Free', ?)", old);
  const liveType = run("INSERT INTO recipe_types (name) VALUES ('Live')");
  const goneRecipe = run('INSERT INTO recipes (name, type_id, deleted_at) VALUES (?, ?, ?)', 'Old salve', liveType, old);
  const goneItem = run("INSERT INTO items (section_id, name, amount, unit, deleted_at) VALUES (1, 'Gone jar', 1, 'g', ?)", old);
  const goneBatch = run("INSERT INTO batches (name, start_date, deleted_at) VALUES ('Old batch', '2026-01-01', ?)", old);
  run("INSERT INTO batch_ingredients (batch_id, name) VALUES (?, 'of gone')", goneBatch);
  run("INSERT INTO batch_steps (batch_id, title) VALUES (?, 'of gone')", goneBatch);
  run("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('batch', ?, '7-abababab.jpg')", goneBatch);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '7-abababab.jpg'), 'x');
  const live = run('INSERT INTO batches (name, start_date, recipe_id, type_id, item_id) VALUES (?, ?, ?, ?, ?)',
    'Live batch', '2026-02-01', goneRecipe, batchType, goneItem);
  const line = run("INSERT INTO batch_ingredients (batch_id, name, item_id, drawn_amount, drawn_unit) VALUES (?, 'Rose', ?, 5, 'g')", live, goneItem);
  run("INSERT INTO batch_ingredients (batch_id, name, deleted_at) VALUES (?, 'replaced', ?)", live, old);
  run("INSERT INTO batch_steps (batch_id, title, deleted_at) VALUES (?, 'replaced', ?)", live, old);
  run("INSERT INTO batch_steps (batch_id, title) VALUES (?, 'keep')", live);

  const counts = purgeSoftDeleted(db, t.dataDir);
  expect(counts).toMatchObject({ photos: 1, batches: 1, items: 1, recipes: 1, recipe_types: 1 });
  expect(db.prepare('SELECT id FROM batches').all().map(r => r.id)).toEqual([live]);
  expect(db.prepare('SELECT name FROM batch_ingredients').all().map(r => r.name)).toEqual(['Rose']);
  expect(db.prepare('SELECT title FROM batch_steps').all().map(r => r.title)).toEqual(['keep']);
  expect(db.prepare('SELECT item_id, drawn_amount FROM batch_ingredients WHERE id = ?').get(line)).toEqual({ item_id: null, drawn_amount: 5 });
  expect(db.prepare('SELECT recipe_id, item_id, name FROM batches WHERE id = ?').get(live)).toEqual({ recipe_id: null, item_id: null, name: 'Live batch' });
  expect(db.prepare('SELECT id FROM recipe_types WHERE id = ?').get(batchType)).toBeDefined();
  expect(db.prepare('SELECT id FROM recipe_types WHERE id = ?').get(freeType)).toBeUndefined();
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '7-abababab.jpg'))).toBe(false);
});
