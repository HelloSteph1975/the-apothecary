import fs from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/connection.js';
import { photosInBackups } from './backup.js';

// Removes records deleted more than `days` ago (children before parents), and photo files unless a kept backup still needs them.
export function purgeSoftDeleted(db, dataDir, { days = 30, now = Date.now() } = {}) {
  const cutoff = new Date(now - days * 86400000).toISOString();
  let files = [];
  const counts = transaction(db, () => {
    const old = table => `SELECT id FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < '${cutoff}'`;
    const photoMatch = `(deleted_at IS NOT NULL AND deleted_at < ?)
      OR (owner_type = 'item' AND owner_id IN (${old('items')}))
      OR (owner_type = 'supplier' AND owner_id IN (${old('suppliers')}))`;
    files = db.prepare(`SELECT filename FROM photos WHERE ${photoMatch}`).all(cutoff).map(r => r.filename);
    const counts = {};
    counts.photos = db.prepare(`DELETE FROM photos WHERE ${photoMatch}`).run(cutoff).changes;
    counts.purchases = db.prepare(`DELETE FROM purchases WHERE id IN (${old('purchases')}) OR item_id IN (${old('items')})`).run().changes;
    counts.items = db.prepare(`DELETE FROM items WHERE id IN (${old('items')})`).run().changes;
    db.prepare(`UPDATE purchases SET supplier_id = NULL WHERE supplier_id IN (${old('suppliers')})`).run();
    counts.suppliers = db.prepare(`DELETE FROM suppliers WHERE id IN (${old('suppliers')})`).run().changes;
    counts.cabinet_sections = db.prepare(`DELETE FROM cabinet_sections WHERE id IN (${old('cabinet_sections')})
      AND id NOT IN (SELECT section_id FROM items)`).run().changes;
    return counts;
  });
  const live = path.join(dataDir, 'photos');
  const trash = path.join(live, '_trash');
  const keep = files.length ? photosInBackups(dataDir) : new Set();
  for (const f of files) {
    try {
      if (keep.has(f)) {
        if (fs.existsSync(path.join(live, f))) fs.renameSync(path.join(live, f), path.join(trash, f));
        continue;
      }
      for (const dir of [live, trash]) fs.rmSync(path.join(dir, f), { force: true });
    } catch {}
  }
  return counts;
}

// Empties trash files older than the cutoff, except ones a kept backup still refers to.
export function purgeTrash(dataDir, olderThanDays = 30, now = Date.now()) {
  const dir = path.join(dataDir, 'photos', '_trash');
  if (!fs.existsSync(dir)) return 0;
  const old = fs.readdirSync(dir).filter(f => now - fs.statSync(path.join(dir, f)).mtimeMs > olderThanDays * 86400000);
  if (!old.length) return 0;
  const keep = photosInBackups(dataDir);
  let n = 0;
  for (const f of old) {
    if (keep.has(f)) continue;
    fs.rmSync(path.join(dir, f), { force: true });
    n++;
  }
  return n;
}
