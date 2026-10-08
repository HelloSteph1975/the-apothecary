import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
export const ALLOWED_TYPES = Object.keys(EXT);
// The shape savePhotoFile gives every photo: <timestamp>-<8 hex>.<ext>.
export const PHOTO_NAME = /^\d+-[0-9a-f]{8}\.(jpg|png|webp|gif)$/i;

const live = (dataDir, f) => path.join(dataDir, 'photos', f);
const trashed = (dataDir, f) => path.join(dataDir, 'photos', '_trash', f);

export function savePhotoFile(dataDir, buffer, mimetype) {
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${EXT[mimetype]}`;
  fs.writeFileSync(live(dataDir, filename), buffer);
  return filename;
}

function move(from, to) {
  if (!fs.existsSync(from)) return;
  fs.renameSync(from, to);
  const now = new Date();
  fs.utimesSync(to, now, now); // trash age starts at the delete
}

export const trashPhotoFile = (dataDir, f) => move(live(dataDir, f), trashed(dataDir, f));
export const restorePhotoFile = (dataDir, f) => move(trashed(dataDir, f), live(dataDir, f));

// After a restore, live photo rows may point at files that were trashed since the backup.
// Bring those back; best effort, and photos added after the backup simply stay on disk.
export function untrashLivePhotos(db, dataDir) {
  let n = 0;
  for (const { filename } of db.prepare('SELECT filename FROM photos WHERE deleted_at IS NULL').all()) {
    if (!PHOTO_NAME.test(filename) || fs.existsSync(live(dataDir, filename))) continue;
    try {
      if (fs.existsSync(trashed(dataDir, filename))) { fs.renameSync(trashed(dataDir, filename), live(dataDir, filename)); n++; }
    } catch { /* leave it in the trash */ }
  }
  return n;
}
