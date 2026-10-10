import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { validate } from '../validate.js';
import { journalEntrySchema, JOURNAL_LINK_TYPES } from '../schemas.js';
import { skyFacts, moonSignAt, localNoon } from '../lib/sky.js';
import { getSettings } from './settings.js';

const GONE = 'That entry is not in the journal.';
const MAX_LINKS = 30;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const PAGE_SIZE = 30;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MOON_GROUPS = ['new', 'waxing', 'full', 'waning'];
const LINK_TABLES = { herb: ['herbs', 'common_name'], recipe: ['recipes', 'name'], batch: ['batches', 'name'] };
const str = v => (typeof v === 'string' && v !== '' ? v : null);
const likeEscape = s => s.replace(/[\\%_]/g, '\\$&');

// The sky stamp ------------------------------------------------------------

// The moon sign is read at the entry's local time (noon when there is no time); the rest is the day's.
export function stampSky(entryDate, entryTime, hemisphere = 'north') {
  const f = skyFacts(entryDate, { hemisphere });
  let at = localNoon(entryDate);
  if (entryTime) {
    const [h, m] = entryTime.split(':').map(Number);
    at = new Date(at.getFullYear(), at.getMonth(), at.getDate(), h, m, 0, 0);
  }
  return {
    sky_phase: f.phase.name, sky_phase_group: f.phase.group, sky_sign: moonSignAt(at).sign,
    sky_ruler: f.ruler, sky_festival: f.festival,
  };
}

// Reading ------------------------------------------------------------------

const COVER_SQL = `(SELECT filename FROM photos p WHERE p.owner_type = 'journal' AND p.owner_id = e.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;

const skyOf = e => ({ phase: e.sky_phase, sign: e.sky_sign, ruler: e.sky_ruler, festival: e.sky_festival });

function tagsFor(db, ids) {
  const out = new Map(ids.map(id => [id, []]));
  if (!ids.length) return out;
  const rows = db.prepare(`SELECT entry_id, tag FROM journal_tags WHERE deleted_at IS NULL AND entry_id IN (${ids.map(() => '?').join(',')})
    ORDER BY id`).all(...ids);
  for (const r of rows) out.get(r.entry_id).push(r.tag);
  return out;
}

function filters(f, skip = []) {
  const where = [];
  const args = [];
  const q = str(f.q);
  if (q) {
    where.push(`(e.title LIKE ? ESCAPE '\\' OR e.body LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM journal_tags qt WHERE qt.entry_id = e.id AND qt.deleted_at IS NULL AND qt.tag LIKE ? ESCAPE '\\'))`);
    args.push(...Array(3).fill(`%${likeEscape(q)}%`));
  }
  if (!skip.includes('type_id') && str(f.type_id)) { where.push('e.type_id = ?'); args.push(Number(f.type_id)); }
  if (!skip.includes('tag') && str(f.tag)) {
    where.push('EXISTS (SELECT 1 FROM journal_tags ft WHERE ft.entry_id = e.id AND ft.deleted_at IS NULL AND ft.tag = ?)');
    args.push(f.tag.trim().toLowerCase());
  }
  if (!skip.includes('phase_group') && str(f.phase_group)) { where.push('e.sky_phase_group = ?'); args.push(f.phase_group); }
  if (str(f.from)) { where.push('e.entry_date >= ?'); args.push(f.from); }
  if (str(f.to)) { where.push('e.entry_date <= ?'); args.push(f.to); }
  return { sql: where.map(w => ` AND ${w}`).join(''), args };
}

function entryRows(db, f) {
  const { sql, args } = filters(f);
  const n = Number(f.page);
  const page = Number.isInteger(n) && n >= 1 ? n : 1;
  const total = db.prepare(`SELECT COUNT(*) n FROM journal_entries e WHERE e.deleted_at IS NULL${sql}`).get(...args).n;
  const rows = db.prepare(`SELECT e.*, t.name AS type_name, t.icon AS type_icon, ${COVER_SQL} AS cover
    FROM journal_entries e LEFT JOIN journal_types t ON t.id = e.type_id
    WHERE e.deleted_at IS NULL${sql}
    ORDER BY e.entry_date DESC, e.entry_time DESC, e.id DESC LIMIT ? OFFSET ?`).all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const tags = tagsFor(db, rows.map(r => r.id));
  const entries = rows.map(e => ({
    id: e.id, title: e.title, entry_date: e.entry_date, entry_time: e.entry_time,
    type: { id: e.type_id, name: e.type_name, icon: e.type_icon }, mood: e.mood,
    excerpt: (e.body ?? '').slice(0, 160), tags: tags.get(e.id), sky: skyOf(e), cover: e.cover,
  }));
  return { entries, total, page };
}

const NONE = { entries: [], total: 0, page: 1 };

// view is list (default), type, tag or moon. The grouped views also return their groups with counts
// (which ignore the chosen group, so the other groups still show) and entries only for the chosen group.
export function listEntries(db, f = {}) {
  const view = ['type', 'tag', 'moon'].includes(f.view) ? f.view : 'list';
  if (view === 'list') return { view, ...entryRows(db, f) };
  if (view === 'type') {
    const { sql, args } = filters(f, ['type_id']);
    const types = db.prepare(`SELECT t.id, t.name, t.icon, COUNT(e.id) AS count FROM journal_types t
      LEFT JOIN journal_entries e ON e.type_id = t.id AND e.deleted_at IS NULL${sql}
      WHERE t.deleted_at IS NULL OR e.id IS NOT NULL GROUP BY t.id ORDER BY t.sort_order, t.id`).all(...args);
    return { view, types, ...(str(f.type_id) ? entryRows(db, f) : NONE) };
  }
  if (view === 'tag') {
    const { sql, args } = filters(f, ['tag']);
    const tags = db.prepare(`SELECT jt.tag, COUNT(DISTINCT e.id) AS count FROM journal_tags jt
      JOIN journal_entries e ON e.id = jt.entry_id AND e.deleted_at IS NULL${sql}
      WHERE jt.deleted_at IS NULL GROUP BY jt.tag ORDER BY jt.tag`).all(...args);
    return { view, tags, ...(str(f.tag) ? entryRows(db, f) : NONE) };
  }
  const { sql, args } = filters(f, ['phase_group']);
  const counts = new Map(db.prepare(`SELECT e.sky_phase_group g, COUNT(*) n FROM journal_entries e WHERE e.deleted_at IS NULL${sql}
    GROUP BY e.sky_phase_group`).all(...args).map(r => [r.g, r.n]));
  const groups = MOON_GROUPS.map(group => ({ group, count: counts.get(group) ?? 0 }));
  return { view, groups, ...(str(f.phase_group) ? entryRows(db, f) : NONE) };
}

export function listTags(db) {
  return db.prepare(`SELECT jt.tag, COUNT(DISTINCT e.id) AS count FROM journal_tags jt
    JOIN journal_entries e ON e.id = jt.entry_id AND e.deleted_at IS NULL
    WHERE jt.deleted_at IS NULL GROUP BY jt.tag ORDER BY jt.tag`).all();
}

export function getEntryDetail(db, id) {
  const r = repos(db);
  const e = r.journalEntries.get(id);
  if (!e) throw notFound(GONE);
  const links = r.journalLinks.list({ entry_id: id }).map(l => {
    const [table, col] = LINK_TABLES[l.link_type];
    const target = db.prepare(`SELECT ${col} AS name, deleted_at FROM ${table} WHERE id = ?`).get(l.link_id);
    return { type: l.link_type, id: l.link_id, name: target?.name ?? null, live: Boolean(target) && target.deleted_at == null };
  });
  return {
    ...e,
    type: r.journalTypes.get(e.type_id, { includeDeleted: true }),
    sky: skyOf(e),
    links,
    tags: r.journalTags.list({ entry_id: id }).map(t => t.tag),
    photos: r.photos.list({ owner_type: 'journal', owner_id: id }),
  };
}

// Writing ------------------------------------------------------------------

const isLive = (db, table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id));

function parseLinks(db, list, errors) {
  if (!Array.isArray(list)) { errors.links = 'Send a list of links'; return undefined; }
  if (list.length > MAX_LINKS) { errors.links = `Use at most ${MAX_LINKS} links`; return undefined; }
  const seen = new Set();
  const out = [];
  list.forEach((raw, i) => {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const id = Number(src.id);
    if (!JOURNAL_LINK_TYPES.includes(src.type)) { errors[`links.${i}`] = 'Link to a herb, recipe or batch'; return; }
    if (!Number.isInteger(id) || id < 1 || !isLive(db, LINK_TABLES[src.type][0], id)) { errors[`links.${i}`] = `That ${src.type} doesn't exist`; return; }
    const key = `${src.type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ link_type: src.type, link_id: id });
  });
  return out;
}

function parseTags(list, errors) {
  if (!Array.isArray(list)) { errors.tags = 'Send a list of tags'; return undefined; }
  const out = [];
  list.forEach((raw, i) => {
    if (typeof raw !== 'string') { errors[`tags.${i}`] = 'Tags must be text'; return; }
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (tag.length > MAX_TAG_LENGTH) { errors[`tags.${i}`] = `Keep tags to ${MAX_TAG_LENGTH} characters`; return; }
    if (!out.includes(tag)) out.push(tag);
  });
  if (out.length > MAX_TAGS) errors.tags = `Use at most ${MAX_TAGS} tags`;
  return out;
}

function parseEntryInput(db, body, { partial }) {
  const src = body && typeof body === 'object' ? body : {};
  const { data = {}, errors = {} } = validate(journalEntrySchema, src, { partial });
  if (data.type_id != null && !isLive(db, 'journal_types', data.type_id)) errors.type_id = "That type doesn't exist";
  if (data.entry_time != null && !TIME.test(data.entry_time)) errors.entry_time = 'Use a time like 14:30';
  if (data.entry_date != null) {
    const year = Number(data.entry_date.slice(0, 4));
    if (year < 1900 || year > 2100) errors.entry_date = 'Pick a date between 1900 and 2100';
  }
  const links = src.links === undefined ? undefined : parseLinks(db, src.links, errors);
  const tags = src.tags === undefined ? undefined : parseTags(src.tags, errors);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  return { data, links, tags };
}

function replaceChildren(db, id, { links, tags }) {
  const r = repos(db);
  const stamp = new Date().toISOString();
  if (links) {
    db.prepare('UPDATE journal_links SET deleted_at = ? WHERE entry_id = ? AND deleted_at IS NULL').run(stamp, id);
    for (const l of links) r.journalLinks.create({ ...l, entry_id: id });
  }
  if (tags) {
    db.prepare('UPDATE journal_tags SET deleted_at = ? WHERE entry_id = ? AND deleted_at IS NULL').run(stamp, id);
    for (const tag of tags) r.journalTags.create({ entry_id: id, tag });
  }
}

// Both return the entry's id.
export function createEntry(db, body) {
  const { data, links = [], tags = [] } = parseEntryInput(db, body, { partial: false });
  const { hemisphere } = getSettings(db);
  return transaction(db, () => {
    const entry = repos(db).journalEntries.create({ ...data, ...stampSky(data.entry_date, data.entry_time ?? null, hemisphere) });
    replaceChildren(db, entry.id, { links, tags });
    return entry.id;
  });
}

export function updateEntry(db, id, body) {
  const r = repos(db);
  const existing = r.journalEntries.get(id);
  if (!existing) throw notFound(GONE);
  const { data, links, tags } = parseEntryInput(db, body, { partial: true });
  const merged = { ...existing, ...data };
  const restamp = merged.entry_date !== existing.entry_date || merged.entry_time !== existing.entry_time;
  const { hemisphere } = getSettings(db);
  transaction(db, () => {
    r.journalEntries.update(id, restamp ? { ...data, ...stampSky(merged.entry_date, merged.entry_time, hemisphere) } : data);
    replaceChildren(db, id, { links, tags });
  });
  return id;
}

// Callers wrap these in a transaction together with the photo cascade.
export function deleteEntry(db, id, stamp) {
  repos(db).journalEntries.remove(id, stamp);
  db.prepare('UPDATE journal_links SET deleted_at = ? WHERE entry_id = ? AND deleted_at IS NULL').run(stamp, id);
  db.prepare('UPDATE journal_tags SET deleted_at = ? WHERE entry_id = ? AND deleted_at IS NULL').run(stamp, id);
}

export function restoreEntry(db, id, stamp) {
  repos(db).journalEntries.restore(id);
  db.prepare('UPDATE journal_links SET deleted_at = NULL WHERE entry_id = ? AND deleted_at = ?').run(id, stamp);
  db.prepare('UPDATE journal_tags SET deleted_at = NULL WHERE entry_id = ? AND deleted_at = ?').run(id, stamp);
}
