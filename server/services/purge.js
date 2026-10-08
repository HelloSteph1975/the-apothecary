import fs from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/connection.js';
import { photosInBackups } from './backup.js';

// Removes photo rows deleted more than `days` ago, and their files unless a kept backup still needs them.
// Later stages add their own tables here, children before parents.
export function purgeSoftDeleted(db, dataDir, { days = 30, now = Date.now() } = {}) {
  const cutoff = new Date(now - days * 86400000).toISOString();
  let files = [];
  const counts = transaction(db, () => {
    files = db.prepare('SELECT filename FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ?').all(cutoff).map(r => r.filename);
    return { photos: db.prepare('DELETE FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff).changes };
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
