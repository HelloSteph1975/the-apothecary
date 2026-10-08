const TS = `created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT`;

// Each entry runs once, in order. Never edit an entry after it ships; add a new one.
export const migrations = [
  // 1: settings and photos. Photos can belong to any kind of record, so owner_type is free text;
  // the photos route checks it against the kinds that exist.
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE photos (id INTEGER PRIMARY KEY, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL,
    filename TEXT NOT NULL, caption TEXT, is_cover INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_photos_owner ON photos(owner_type, owner_id);
  `,
];

export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = current; i < migrations.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migrations[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
