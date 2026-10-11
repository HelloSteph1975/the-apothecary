import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { validate } from '../validate.js';
import { gardenPlantSchema, gardenEntrySchema, GARDEN_KINDS, GARDEN_TASKS, PLANT_PARTS } from '../schemas.js';
import { addDays } from '../lib/dates.js';
import { skyFacts } from '../lib/sky.js';
import { getSettings } from './settings.js';
import { stampSky } from './journal.js';
import { listTimingRules, localToday, matches } from './timing.js';

const PLANT_GONE = 'That plant is not in the garden log.';
const ENTRY_GONE = 'That garden entry is not in the log.';
const FIX = 'Please fix the highlighted fields.';
const PAGE_SIZE = 30;
const DETAIL_ENTRIES = 50;
const TOP_DAYS = 5;
const MAX_DAYS = 42;
const DEFAULT_DAYS = 28;
const STATUSES = ['growing', 'ended', 'all'];
const DATE_RANGE = 'Pick a date between 1900 and 2100';

// "Harvested Calendula": the kind with a capital, then the plant name as stored. The gallery and journal build the same text in SQL, and client/src/lib/garden.js has a copy; all of them must match.
export const entryTitle = (kind, plantName) => `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${plantName}`;

const isLive = (db, table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id));
const parseList = text => { try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch { return []; } };
const blank = v => v == null || (typeof v === 'string' && v.trim() === '');
const fail = errors => { throw new HttpError(400, FIX, errors); };

function checkYears(data, fields, errors) {
  for (const f of fields) {
    if (data[f] != null && !errors[f]) {
      const year = Number(data[f].slice(0, 4));
      if (year < 1900 || year > 2100) errors[f] = DATE_RANGE;
    }
  }
}

// Plants -------------------------------------------------------------------

const PLANT_COVER = `(SELECT filename FROM photos p WHERE p.owner_type = 'garden_plant' AND p.owner_id = g.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;

const herbRef = row => (row.herb_id == null ? null : { id: row.herb_id, name: row.herb_name, live: row.herb_deleted == null });

const lastEntry = (db, plantId) => db.prepare(`SELECT id, kind, entry_date FROM garden_entries WHERE plant_id = ? AND deleted_at IS NULL
  ORDER BY entry_date DESC, id DESC LIMIT 1`).get(plantId) ?? null;

const plantSelect = `SELECT g.*, h.common_name AS herb_name, h.deleted_at AS herb_deleted, ${PLANT_COVER} AS cover
  FROM garden_plants g LEFT JOIN herbs h ON h.id = g.herb_id`;

export function listPlants(db, { status = 'growing' } = {}) {
  if (!STATUSES.includes(status)) fail({ status: `Must be one of: ${STATUSES.join(', ')}` });
  const where = status === 'growing' ? ' AND g.ended_on IS NULL' : status === 'ended' ? ' AND g.ended_on IS NOT NULL' : '';
  return db.prepare(`${plantSelect} WHERE g.deleted_at IS NULL${where} ORDER BY g.name COLLATE NOCASE, g.id`).all().map(p => ({
    id: p.id, name: p.name, herb: herbRef(p), place: p.place, planted_on: p.planted_on, expected_harvest_on: p.expected_harvest_on,
    ended_on: p.ended_on, last_entry: lastEntry(db, p.id), cover: p.cover,
  }));
}

function gardenNotes(db, herbId) {
  if (herbId == null) return null;
  const h = repos(db).herbs.get(herbId);
  if (!h) return null;
  return {
    garden_harvest_part: h.garden_harvest_part, garden_harvest_timing: h.garden_harvest_timing, garden_sun: h.garden_sun,
    garden_water: h.garden_water, garden_companions: parseList(h.garden_companions),
  };
}

export function getPlantDetail(db, id) {
  const p = db.prepare(`${plantSelect} WHERE g.id = ? AND g.deleted_at IS NULL`).get(id);
  if (!p) throw notFound(PLANT_GONE);
  const { herb_name, herb_deleted, cover, ...row } = p;
  return {
    ...row, herb: herbRef(p), garden_notes: gardenNotes(db, p.herb_id), last_entry: lastEntry(db, id),
    entries: queryEntries(db, { plant_id: id }, DETAIL_ENTRIES, 0).rows,
    photos: repos(db).photos.list({ owner_type: 'garden_plant', owner_id: id }),
  };
}

function parsePlantInput(db, body, { partial, existing }) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
  const herbId = Object.hasOwn(src, 'herb_id') ? src.herb_id : existing?.herb_id;
  // With a herb chosen and no name, the plant takes the herb's common name.
  if ((!partial || Object.hasOwn(src, 'name')) && blank(src.name) && !blank(herbId)) {
    const herb = Number.isInteger(Number(herbId)) ? repos(db).herbs.get(Number(herbId)) : null;
    if (herb) src.name = herb.common_name;
  }
  const { data = {}, errors = {} } = validate(gardenPlantSchema, src, { partial });
  if (data.herb_id != null && data.herb_id !== existing?.herb_id && !isLive(db, 'herbs', data.herb_id)) errors.herb_id = "That herb doesn't exist";
  checkYears(data, ['planted_on', 'expected_harvest_on', 'ended_on'], errors);
  const merged = { ...existing, ...data };
  if (merged.planted_on) {
    for (const f of ['ended_on', 'expected_harvest_on']) {
      if (!errors[f] && merged[f] && merged[f] < merged.planted_on) errors[f] = 'This must not be before the planting date.';
    }
  }
  if (Object.keys(errors).length) fail(errors);
  return data;
}

export function createPlant(db, body) {
  const data = parsePlantInput(db, body, { partial: false, existing: null });
  return repos(db).gardenPlants.create(data).id;
}

export function updatePlant(db, id, body) {
  const r = repos(db);
  const existing = r.gardenPlants.get(id);
  if (!existing) throw notFound(PLANT_GONE);
  const data = parsePlantInput(db, body, { partial: true, existing });
  transaction(db, () => {
    r.gardenPlants.update(id, data);
    const merged = { ...existing, ...data };
    // Entries keep their own copy of the name, so they follow when the plant is renamed or its herb changes.
    if (merged.name !== existing.name || merged.herb_id !== existing.herb_id) {
      db.prepare("UPDATE garden_entries SET plant_name = ?, herb_id = ?, updated_at = datetime('now') WHERE plant_id = ?")
        .run(merged.name, merged.herb_id ?? null, id);
    }
  });
  return id;
}

export function deletePlant(db, id, stamp) {
  if (!repos(db).gardenPlants.remove(id, stamp)) throw notFound(PLANT_GONE);
}

export function restorePlant(db, id) {
  repos(db).gardenPlants.restore(id);
}

// Entries -------------------------------------------------------------------

const ENTRY_COVER = `(SELECT filename FROM photos p WHERE p.owner_type = 'garden_entry' AND p.owner_id = e.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;

const entrySelect = `SELECT e.*, gp.name AS plant_current_name, gp.deleted_at AS plant_deleted, it.name AS item_name, it.deleted_at AS item_deleted,
  ${ENTRY_COVER} AS cover
  FROM garden_entries e LEFT JOIN garden_plants gp ON gp.id = e.plant_id LEFT JOIN items it ON it.id = e.item_id`;

function shapeEntry(e) {
  return {
    id: e.id, entry_date: e.entry_date, kind: e.kind, title: entryTitle(e.kind, e.plant_name),
    plant: e.plant_id == null ? null : { id: e.plant_id, name: e.plant_current_name, live: e.plant_deleted == null },
    plant_name: e.plant_name, place: e.place, amount: e.amount, unit: e.unit, weather: e.weather,
    sky: { phase: e.sky_phase, sign: e.sky_sign },
    item: e.item_id == null ? null : { id: e.item_id, name: e.item_name, live: e.item_deleted == null },
    cover: e.cover,
  };
}

function queryEntries(db, f, limit, offset) {
  const where = [];
  const args = [];
  if (f.kind) { where.push('e.kind = ?'); args.push(f.kind); }
  if (f.plant_id != null) { where.push('e.plant_id = ?'); args.push(f.plant_id); }
  if (f.herb_id != null) { where.push('e.herb_id = ?'); args.push(f.herb_id); }
  if (f.from) { where.push('e.entry_date >= ?'); args.push(f.from); }
  if (f.to) { where.push('e.entry_date <= ?'); args.push(f.to); }
  const sql = where.map(w => ` AND ${w}`).join('');
  const total = db.prepare(`SELECT COUNT(*) n FROM garden_entries e WHERE e.deleted_at IS NULL${sql}`).get(...args).n;
  const rows = db.prepare(`${entrySelect} WHERE e.deleted_at IS NULL${sql} ORDER BY e.entry_date DESC, e.id DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset).map(shapeEntry);
  return { rows, total };
}

// f: kind, plant_id, herb_id (numbers), from, to (dates) and page, already checked by the route.
export function listEntries(db, f = {}) {
  if (f.kind != null && !GARDEN_KINDS.includes(f.kind)) fail({ kind: `Must be one of: ${GARDEN_KINDS.join(', ')}` });
  const n = Number(f.page);
  const page = Number.isInteger(n) && n >= 1 ? n : 1;
  const { rows, total } = queryEntries(db, f, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return { entries: rows, total, page };
}

// Every live entry, for pickers that must see all of them.
export function entryOptions(db) {
  return db.prepare('SELECT id, kind, plant_name, entry_date FROM garden_entries WHERE deleted_at IS NULL ORDER BY entry_date DESC, id DESC').all()
    .map(e => ({ id: e.id, title: entryTitle(e.kind, e.plant_name), entry_date: e.entry_date }));
}

export function getEntryDetail(db, id) {
  const e = db.prepare(`${entrySelect} WHERE e.id = ? AND e.deleted_at IS NULL`).get(id);
  if (!e) throw notFound(ENTRY_GONE);
  const { plant_current_name, plant_deleted, item_name, item_deleted, ...row } = e;
  return { ...row, ...shapeEntry(e), photos: repos(db).photos.list({ owner_type: 'garden_entry', owner_id: id }) };
}

function parseEntryInput(db, body, { partial, existing }) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const { data = {}, errors = {} } = validate(gardenEntrySchema, src, { partial });
  checkYears(data, ['entry_date'], errors);
  const merged = { ...existing, ...data };
  const plantChanged = data.plant_id != null && data.plant_id !== existing?.plant_id;
  let plant = null;
  if (plantChanged) {
    plant = repos(db).gardenPlants.get(data.plant_id);
    if (!plant) errors.plant_id = "That plant doesn't exist";
  }
  if (plant) {
    data.plant_name = plant.name;
    data.herb_id = plant.herb_id;
    if (blank(merged.place)) data.place = plant.place;
  } else if (merged.plant_id == null) {
    if (blank(merged.plant_name)) errors.plant_name = 'Required';
    if (data.herb_id != null && data.herb_id !== existing?.herb_id && !isLive(db, 'herbs', data.herb_id)) errors.herb_id = "That herb doesn't exist";
  } else if (existing?.plant_id === merged.plant_id) {
    // Still linked to the same plant: its name and herb stay with the plant.
    delete data.plant_name;
    delete data.herb_id;
  }
  if (Object.keys(errors).length) fail(errors);
  return data;
}

export function createEntry(db, body) {
  const data = parseEntryInput(db, body, { partial: false, existing: null });
  const { hemisphere } = getSettings(db);
  const { sky_phase, sky_phase_group, sky_sign } = stampSky(data.entry_date, null, hemisphere);
  return repos(db).gardenEntries.create({ ...data, sky_phase, sky_phase_group, sky_sign }).id;
}

export function updateEntry(db, id, body) {
  const r = repos(db);
  const existing = r.gardenEntries.get(id);
  if (!existing) throw notFound(ENTRY_GONE);
  const data = parseEntryInput(db, body, { partial: true, existing });
  if (data.entry_date !== undefined && data.entry_date !== existing.entry_date) {
    const { hemisphere } = getSettings(db);
    const { sky_phase, sky_phase_group, sky_sign } = stampSky(data.entry_date, null, hemisphere);
    Object.assign(data, { sky_phase, sky_phase_group, sky_sign });
  }
  r.gardenEntries.update(id, data);
  return id;
}

export function deleteEntry(db, id, stamp) {
  if (!repos(db).gardenEntries.remove(id, stamp)) throw notFound(ENTRY_GONE);
}

export function restoreEntry(db, id) {
  repos(db).gardenEntries.restore(id);
}

// What a jar made from a harvest starts with. Empty fields are left out.
export function jarPrefill(db, id) {
  const e = repos(db).gardenEntries.get(id);
  if (!e) throw notFound(ENTRY_GONE);
  if (e.kind !== 'harvested' && e.kind !== 'foraged') fail({ kind: 'Only a harvest or a foraging can go into the cabinet.' });
  const herb = e.herb_id == null ? null : repos(db).herbs.get(e.herb_id);
  const out = {
    name: e.plant_name, herb_id: e.herb_id, latin_name: herb?.latin_name, source_kind: e.kind === 'harvested' ? 'grown' : 'foraged',
    source_place: e.place, acquired_on: e.entry_date, amount: e.amount, unit: e.unit, form: 'fresh',
    plant_part: PLANT_PARTS.includes(herb?.garden_harvest_part) ? herb.garden_harvest_part : null,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}

// Moon gardening days ---------------------------------------------------------

// The live rules that advise the garden.
const gardenRules = db => listTimingRules(db).filter(rule => rule.garden_tasks.length);

function dayTasks(rules, sky) {
  const hits = rules.filter(rule => matches(rule, sky));
  return GARDEN_TASKS.map(task => {
    const mine = hits.filter(rule => rule.garden_tasks.includes(task));
    return { task, score: mine.reduce((n, rule) => n + rule.weight, 0), reasons: mine.map(rule => rule.text) };
  }).filter(t => t.reasons.length);
}

// For the calendar and day page: [{ task, reasons }] for one day, empty when suggestions are off.
// Pass `rules` (from loadGardenRules) when asking for many days, so they load once.
export function loadGardenRules(db) { return gardenRules(db); }

export function gardenDayTasks(db, day, settings, rules = gardenRules(db)) {
  if (settings.sky_suggestions === 'off') return [];
  const sky = skyFacts(day, { hemisphere: settings.hemisphere });
  return dayTasks(rules, sky).map(({ task, reasons }) => ({ task, reasons }));
}

export function gardenSuggestions(db, { from, days = DEFAULT_DAYS } = {}, settings) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) fail({ days: `Use a number from 1 to ${MAX_DAYS}` });
  if (settings.sky_suggestions === 'off') return { off: true, tasks: [] };
  const start = from ?? localToday();
  const rules = gardenRules(db);
  const byTask = new Map(GARDEN_TASKS.map(t => [t, []]));
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const sky = skyFacts(day, { hemisphere: settings.hemisphere });
    for (const t of dayTasks(rules, sky)) {
      byTask.get(t.task).push({ day, score: t.score, sky: { phase: sky.phase.name, sign: sky.moon.sign, ruler: sky.ruler }, reasons: t.reasons });
    }
  }
  const tasks = GARDEN_TASKS.map(task => ({
    task, days: byTask.get(task).sort((a, b) => b.score - a.score || a.day.localeCompare(b.day)).slice(0, TOP_DAYS),
  })).filter(t => t.days.length);
  return { off: false, tasks };
}
