import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError } from '../http.js';
import { deleteGroup, reorderGroups } from './groups.js';

// Bump when recipe-types.json gains entries that existing installs should receive.
export const RECIPE_TYPES_SEED_VERSION = 1;

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'recipe-types.json');
const SEED_KEY = 'recipe_types_seed_version';

export function loadStarterTypes(file = DATA_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Adds each starter type whose slug isn't there yet (live or deleted), so her edits and deletions stand.
export function seedRecipeTypes(db, entries = loadStarterTypes()) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_KEY);
  if (row && Number(row.value) >= RECIPE_TYPES_SEED_VERSION) return { added: 0 };
  const r = repos(db);
  return transaction(db, () => {
    let added = 0;
    const exists = db.prepare('SELECT 1 FROM recipe_types WHERE slug = ?');
    entries.forEach((e, i) => {
      if (exists.get(e.slug)) return;
      r.recipeTypes.create({
        slug: e.slug, name: e.name, description: e.description ?? null, wait_days: e.wait_days ?? null,
        shelf_life_days: e.shelf_life_days ?? null, label_caution: e.label_caution ?? null, is_topical: e.is_topical ? 1 : 0,
        icon: e.icon ?? null, sort_order: i, is_starter: 1,
      });
      added++;
    });
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(SEED_KEY, String(RECIPE_TYPES_SEED_VERSION));
    return { added };
  });
}

// Her own types ------------------------------------------------------------

export function listRecipeTypes(db) {
  return db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM recipes r WHERE r.type_id = t.id AND r.deleted_at IS NULL) AS recipe_count
    FROM recipe_types t WHERE t.deleted_at IS NULL ORDER BY t.sort_order, t.id`).all();
}

// Names are unique among live types, ignoring case, so the type picker never shows two of the same.
export function assertUniqueTypeName(db, name, exceptId = null) {
  if (typeof name !== 'string') return;
  const wanted = name.trim().toLowerCase();
  const clash = db.prepare('SELECT id, name FROM recipe_types WHERE deleted_at IS NULL').all()
    .some(t => t.id !== exceptId && t.name.trim().toLowerCase() === wanted);
  if (clash) throw new HttpError(400, 'Please fix the highlighted fields.', { name: 'You already have a type with this name.' });
}

export function nextTypeOrder(db) {
  return db.prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) n FROM recipe_types WHERE deleted_at IS NULL').get().n;
}

export function deleteRecipeType(db, id, moveTo, stamp) {
  deleteGroup(db, {
    repo: repos(db).recipeTypes, childTable: 'recipes', childKey: 'type_id', label: 'type', id, moveTo, stamp,
    messages: { gone: 'That type is gone.', moveFirst: 'Move its recipes to another type first.', countKey: 'recipes',
      samePick: 'Pick a different type to move them into.' },
  });
}

export function reorderRecipeTypes(db, ids) {
  reorderGroups(db, repos(db).recipeTypes, ids, 'Send the type ids in their new order.');
  return listRecipeTypes(db);
}
