import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError } from '../http.js';
import { deleteGroup, reorderGroups } from './groups.js';

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

// Her own types ------------------------------------------------------------

export function listJournalTypes(db) {
  return db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM journal_entries e WHERE e.type_id = t.id AND e.deleted_at IS NULL) AS entry_count
    FROM journal_types t WHERE t.deleted_at IS NULL ORDER BY t.sort_order, t.id`).all();
}

// Names are unique among live types, ignoring case, so the type picker never shows two of the same.
export function assertUniqueJournalTypeName(db, name, exceptId = null) {
  if (typeof name !== 'string') return;
  const wanted = name.trim().toLowerCase();
  const clash = db.prepare('SELECT id, name FROM journal_types WHERE deleted_at IS NULL').all()
    .some(t => t.id !== exceptId && t.name.trim().toLowerCase() === wanted);
  if (clash) throw new HttpError(400, 'Please fix the highlighted fields.', { name: 'You already have a type with this name.' });
}

export function nextJournalTypeOrder(db) {
  return db.prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) n FROM journal_types WHERE deleted_at IS NULL').get().n;
}

export function deleteJournalType(db, id, moveTo, stamp) {
  deleteGroup(db, {
    repo: repos(db).journalTypes, childTable: 'journal_entries', childKey: 'type_id', label: 'type', id, moveTo, stamp,
    messages: { gone: 'That type is gone.', moveFirst: 'Move its entries to another type first.', countKey: 'entries',
      samePick: 'Pick a different type to move them into.' },
  });
}

export function reorderJournalTypes(db, ids) {
  reorderGroups(db, repos(db).journalTypes, ids, 'Send the type ids in their new order.');
  return listJournalTypes(db);
}
