import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { GRIMOIRE_SEED_VERSION, STARTER_ORDER } from '../data/grimoire/index.js';

export { GRIMOIRE_SEED_VERSION, STARTER_ORDER };

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'grimoire');
const SEED_KEY = 'grimoire_seed_version';
const LIST_FIELDS = ['other_names', 'parts_used', 'preparations', 'zodiac', 'associations', 'garden_companions'];

export function loadStarterHerbs(dir = DATA_DIR) {
  const entries = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const rank = e => { const i = STARTER_ORDER.indexOf(e.slug); return i === -1 ? STARTER_ORDER.length : i; };
  return entries.sort((a, b) => rank(a) - rank(b) || String(a.slug).localeCompare(String(b.slug)));
}

export function seedGrimoire(db, entries = loadStarterHerbs()) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_KEY);
  if (row && Number(row.value) >= GRIMOIRE_SEED_VERSION) return { added: 0 };
  const r = repos(db);
  return transaction(db, () => {
    let added = 0;
    const exists = db.prepare('SELECT 1 FROM herbs WHERE slug = ?');
    for (const { sources = [], ...entry } of entries) {
      if (exists.get(entry.slug)) continue;
      const data = { ...entry, is_starter: 1 };
      for (const f of LIST_FIELDS) data[f] = JSON.stringify(entry[f] ?? []);
      const herb = r.herbs.create(data);
      sources.forEach((s, i) => r.herbSources.create({
        herb_id: herb.id, title: s.title, author: s.author ?? null, year: s.year ?? null, url: s.url ?? null,
        covers: JSON.stringify(s.covers ?? []), sort_order: i,
      }));
      added++;
    }
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(SEED_KEY, String(GRIMOIRE_SEED_VERSION));
    return { added };
  });
}

const norm = s => (typeof s === 'string' ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '');
const twoWords = s => s.split(' ').slice(0, 2).join(' ');

function parseList(text) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Every name a herb answers to, including "R. gallica" style abbreviations expanded with the genus.
function herbKeys(h) {
  const keys = new Set([norm(h.common_name), ...parseList(h.other_names).map(norm)]);
  const latin = norm(h.latin_name);
  if (latin) {
    keys.add(latin);
    keys.add(twoWords(latin));
    const genus = latin.split(' ')[0];
    for (const m of latin.matchAll(/\b([a-z])\.\s*([a-z-]+)/g)) {
      if (genus.startsWith(m[1])) keys.add(`${genus} ${m[2]}`);
    }
  }
  keys.delete('');
  return keys;
}

export function linkItemsToHerbs(db) {
  return transaction(db, () => {
    const herbs = db.prepare('SELECT * FROM herbs WHERE deleted_at IS NULL').all().map(h => ({ id: h.id, keys: herbKeys(h) }));
    const items = db.prepare(`SELECT i.id, i.name, i.latin_name FROM items i JOIN cabinet_sections s ON s.id = i.section_id
      WHERE i.deleted_at IS NULL AND i.herb_id IS NULL AND s.kind = 'herb'`).all();
    const set = db.prepare("UPDATE items SET herb_id = ?, updated_at = datetime('now') WHERE id = ?");
    let linked = 0;
    for (const item of items) {
      const name = norm(item.name);
      const latin = norm(item.latin_name);
      const wanted = new Set([name, latin, latin && twoWords(latin)].filter(Boolean));
      const matches = herbs.filter(h => [...wanted].some(w => h.keys.has(w)));
      if (matches.length === 1) { set.run(matches[0].id, item.id); linked++; }
    }
    return { linked };
  });
}
