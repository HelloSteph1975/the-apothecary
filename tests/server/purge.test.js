import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
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
