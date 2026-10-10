import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';

// Bump when journal-types.json gains entries that existing installs should receive.
export const JOURNAL_TYPES_SEED_VERSION = 1;

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'journal-types.json');
const SEED_KEY = 'journal_types_seed_version';

export function loadStarterJournalTypes(file = DATA_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Adds each starter type whose slug isn't there yet (live or deleted), so her edits and deletions stand.
export function seedJournalTypes(db, entries = loadStarterJournalTypes()) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_KEY);
  if (row && Number(row.value) >= JOURNAL_TYPES_SEED_VERSION) return { added: 0 };
  const r = repos(db);
  return transaction(db, () => {
    let added = 0;
    const exists = db.prepare('SELECT 1 FROM journal_types WHERE slug = ?');
    entries.forEach((e, i) => {
      if (exists.get(e.slug)) return;
      r.journalTypes.create({ slug: e.slug, name: e.name, description: e.description ?? null, icon: e.icon ?? null, sort_order: i, is_starter: 1 });
      added++;
    });
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(SEED_KEY, String(JOURNAL_TYPES_SEED_VERSION));
    return { added };
  });
}
