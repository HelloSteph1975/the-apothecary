import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';

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
