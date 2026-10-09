import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { validate } from '../validate.js';
import { itemStatus } from './cabinet.js';
import { herbSchema, herbSourceSchema, PLANT_PARTS, RECIPE_TYPES, SOURCE_COVERS } from '../schemas.js';
import { GRIMOIRE_SEED_VERSION, STARTER_ORDER } from '../data/grimoire/index.js';

export { GRIMOIRE_SEED_VERSION, STARTER_ORDER };

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'grimoire');
const SEED_KEY = 'grimoire_seed_version';
const LINK_KEY = 'grimoire_link_version';
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
// "Genus species" for matching partial Latin names. Hybrids ("Mentha × piperita") and "spp." give no such key.
const twoWords = s => {
  const [genus, second] = s.split(' ');
  if (second === '×' || second === 'x' || second?.endsWith('.')) return null;
  return second ? `${genus} ${second}` : genus;
};

function parseList(text) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Every name a herb answers to, including "R. gallica" style abbreviations expanded with the genus.
function herbKeys(h) {
  const keys = new Set([norm(h.common_name), ...parseList(h.other_names).map(norm)]);
  const latin = norm(h.latin_name);
  if (latin) {
    keys.add(latin);
    const two = twoWords(latin);
    if (two) keys.add(two);
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

// Links jars once per grimoire seed version, so a jar the user unlinks by hand stays unlinked after a restart.
export function linkItemsOnce(db) {
  const get = key => Number(db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? 0);
  if (get(SEED_KEY) < GRIMOIRE_SEED_VERSION || get(LINK_KEY) >= GRIMOIRE_SEED_VERSION) return { linked: 0 };
  const result = linkItemsToHerbs(db);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(LINK_KEY, String(GRIMOIRE_SEED_VERSION));
  return result;
}

// Reading ------------------------------------------------------------------

const COVER_SQL = `(SELECT filename FROM photos p WHERE p.owner_type = 'herb' AND p.owner_id = h.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;
const CAUTIONS = ['pregnancy', 'medications', 'conditions', 'duration', 'topical'];
const str = v => (typeof v === 'string' && v !== '' ? v : null);

export function listHerbs(db, f = {}) {
  const where = [];
  const args = [];
  const q = str(f.q);
  if (q) {
    where.push('(h.common_name LIKE ? OR h.other_names LIKE ? OR h.latin_name LIKE ? OR h.associations LIKE ?)');
    args.push(...Array(4).fill(`%${q}%`));
  }
  if (str(f.part)) { where.push('EXISTS (SELECT 1 FROM json_each(h.parts_used) WHERE value = ?)'); args.push(f.part); }
  if (str(f.planet)) { where.push('h.planet = ?'); args.push(f.planet); }
  if (str(f.element)) { where.push('h.element = ?'); args.push(f.element); }
  if (f.has_jars === '1') where.push('EXISTS (SELECT 1 FROM items i WHERE i.herb_id = h.id AND i.deleted_at IS NULL)');
  if (CAUTIONS.includes(f.caution)) where.push(`h.caution_${f.caution} IS NOT NULL`);
  const rows = db.prepare(`SELECT h.*, ${COVER_SQL} AS cover,
      (SELECT COUNT(*) FROM items i WHERE i.herb_id = h.id AND i.deleted_at IS NULL) AS jar_count
    FROM herbs h WHERE h.deleted_at IS NULL${where.map(w => ` AND ${w}`).join('')}
    ORDER BY h.common_name COLLATE NOCASE, h.id`).all(...args);
  return rows.map(h => ({
    id: h.id, slug: h.slug, common_name: h.common_name, latin_name: h.latin_name, parts_used: parseList(h.parts_used),
    planet: h.planet, element: h.element, ahpa_class: h.ahpa_class,
    has_cautions: CAUTIONS.some(c => h[`caution_${c}`] != null), jar_count: h.jar_count, cover: h.cover,
  }));
}

export function getHerbDetail(db, id, today = new Date().toISOString().slice(0, 10)) {
  const r = repos(db);
  const herb = r.herbs.get(id);
  if (!herb) throw notFound('That herb is not in the grimoire.');
  for (const f of LIST_FIELDS) herb[f] = parseList(herb[f]);
  const sources = r.herbSources.list({ herb_id: id }).map(s => ({ ...s, covers: parseList(s.covers) }));
  const jars = db.prepare(`SELECT id, name, amount, unit, size_label, expires_on, low_threshold, used_up_at FROM items
    WHERE herb_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE, id`).all(id)
    .map(({ low_threshold, used_up_at, ...j }) => ({ ...j, status: itemStatus({ ...j, low_threshold, used_up_at }, today) }));
  return { ...herb, sources, photos: r.photos.list({ owner_type: 'herb', owner_id: id }), jars };
}

export function herbOfTheDay(db, today) {
  const ids = db.prepare('SELECT id FROM herbs WHERE deleted_at IS NULL ORDER BY id').all();
  if (!ids.length) return null;
  const [y, m, d] = today.split('-').map(Number);
  const days = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000);
  const id = ids[((days % ids.length) + ids.length) % ids.length].id;
  const h = db.prepare(`SELECT h.id, h.common_name, h.latin_name, h.uses, h.planet, h.element, ${COVER_SQL} AS cover
    FROM herbs h WHERE h.id = ?`).get(id);
  const first = h.uses ? (h.uses.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? h.uses) : null;
  return { ...h, uses: first };
}

// Writing ------------------------------------------------------------------

const LIST_RULES = {
  other_names: null, parts_used: PLANT_PARTS, preparations: RECIPE_TYPES, zodiac: null, associations: null, garden_companions: null,
};
const URL_OK = /^https?:\/\/\S/i;

function checkList(value, allowed) {
  if (!Array.isArray(value)) return { error: 'Must be a list' };
  if (value.length > 30) return { error: 'Use at most 30 entries' };
  const out = [];
  for (const v of value) {
    if (typeof v !== 'string' || !v.trim()) return { error: 'Entries must be text, not blank' };
    if (v.trim().length > 80) return { error: 'Keep each entry under 80 characters' };
    if (allowed && !allowed.includes(v.trim())) return { error: `Must be from: ${allowed.join(', ')}` };
    out.push(v.trim());
  }
  return { value: out };
}

function parseHerbInput(body, { partial }) {
  const src = body ?? {};
  const { data = {}, errors = {} } = validate(herbSchema, src, { partial });
  for (const [field, allowed] of Object.entries(LIST_RULES)) {
    if (!Object.prototype.hasOwnProperty.call(src, field)) continue;
    const r = checkList(src[field] ?? [], allowed);
    if (r.error) errors[field] = r.error;
    else data[field] = JSON.stringify(r.value);
  }
  let sources;
  if (src.sources !== undefined) {
    if (!Array.isArray(src.sources) || src.sources.length > 30) errors.sources = 'Send a list of at most 30 sources';
    else {
      sources = [];
      src.sources.forEach((raw, i) => {
        const res = validate(herbSourceSchema, { ...raw, sort_order: i });
        const row = res.data ?? {};
        for (const [k, msg] of Object.entries(res.errors ?? {})) errors[`sources.${i}.${k}`] = msg;
        if (row.url && !URL_OK.test(row.url)) errors[`sources.${i}.url`] = 'Must start with http:// or https://';
        const covers = checkList(raw?.covers ?? [], SOURCE_COVERS);
        if (covers.error) errors[`sources.${i}.covers`] = covers.error;
        else row.covers = JSON.stringify(covers.value);
        sources.push(row);
      });
    }
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  return { data, sources };
}

function replaceSources(db, herbId, sources, stamp) {
  const r = repos(db);
  db.prepare('UPDATE herb_sources SET deleted_at = ? WHERE herb_id = ? AND deleted_at IS NULL').run(stamp, herbId);
  for (const s of sources) r.herbSources.create({ ...s, herb_id: herbId });
}

// Both return the herb's id. User-added herbs never get a slug, and slug is never read from the client.
export function createHerb(db, body) {
  const { data, sources = [] } = parseHerbInput(body, { partial: false });
  return transaction(db, () => {
    const herb = repos(db).herbs.create({ ...data, slug: null, is_starter: 0 });
    replaceSources(db, herb.id, sources, new Date().toISOString());
    return herb.id;
  });
}

export function updateHerb(db, id, body) {
  const r = repos(db);
  if (!r.herbs.get(id)) throw notFound('That herb is not in the grimoire.');
  const { data, sources } = parseHerbInput(body, { partial: true });
  transaction(db, () => {
    r.herbs.update(id, data);
    if (sources) replaceSources(db, id, sources, new Date().toISOString());
  });
  return id;
}
