import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { check, validate } from '../validate.js';
import { batchSchema, batchLineSchema, batchStepSchema, finishSchema, UNITS } from '../schemas.js';
import { addDays, isDate } from '../lib/dates.js';
import { convert } from '../lib/units.js';
import { getRecipeDetail } from './recipes.js';
import { createItem, drawFromItem } from './cabinet.js';
import { getSettings } from './settings.js';
import { skyFacts } from '../lib/sky.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from './photos.js';

const GONE = 'That batch is not in the journal.';
const FIX = 'Please fix the highlighted fields.';
const MAX_LINES = 60;
const MAX_STEPS = 30;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const str = v => (typeof v === 'string' && v !== '' ? v : null);
const likeEscape = s => s.replace(/[\\%_]/g, '\\$&');
const round4 = n => Math.round((n + Number.EPSILON) * 1e4) / 1e4;
const isObject = v => v && typeof v === 'object' && !Array.isArray(v);

// The same wording as the recipe page's shelf text: weeks, whole years, otherwise days.
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export function shelfText(n) {
  if (n != null && n > 0 && n % 365 === 0) return plural(n / 365, 'year');
  if (n != null && n > 0 && n % 7 === 0) return plural(n / 7, 'week');
  return plural(n, 'day');
}

function localToday() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayName(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// Planning ----------------------------------------------------------------

function buildLine(ing, items) {
  const wanted = ing.name?.trim().toLowerCase();
  const linked = it => ing.herb_id != null && it.herb_id === ing.herb_id;
  const named = it => Boolean(wanted) && it.name.trim().toLowerCase() === wanted;
  const candidates = items
    .filter(it => linked(it) || named(it))
    .map(it => {
      const draw = ing.amount != null && ing.unit ? convert(ing.amount, ing.unit, it.unit) : null;
      return { id: it.id, name: it.name, amount: it.amount, unit: it.unit, expires_on: it.expires_on, convertible: draw != null, draw, linked: linked(it) };
    });
  const rank = c => [c.linked ? 0 : 1, c.convertible ? 0 : 1, c.convertible && c.amount >= c.draw ? 0 : 1];
  candidates.sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2]
      || (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999')
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id - b.id;
  });
  for (const c of candidates) delete c.linked;
  const best = candidates[0] ?? null;
  const suggested_draw = best?.draw ?? null;
  let flag = null;
  if (!best) flag = 'no_jar';
  else if (ing.amount == null) flag = 'no_amount';
  else if (suggested_draw == null) flag = 'no_conversion';
  else if (best.amount < suggested_draw) flag = 'not_enough';
  return {
    herb_id: ing.herb_id, name: ing.name, amount: ing.amount, unit: ing.unit,
    candidates,
    suggested_item_id: best?.id ?? null, suggested_draw: ing.amount == null ? null : suggested_draw, flag,
  };
}

export function planBatch(db, body) {
  const src = isObject(body) ? body : {};
  const { recipe_id, start_date } = check({ recipe_id: 'int!', start_date: 'date' }, src);
  const detail = getRecipeDetail(db, recipe_id, { scale: src.scale, yield: src.yield });
  const start = start_date ?? localToday();
  const items = db.prepare('SELECT id, name, herb_id, amount, unit, expires_on FROM items WHERE deleted_at IS NULL AND used_up_at IS NULL').all();
  const wait = detail.effective_wait_days;
  const shelf = detail.effective_shelf_life_days;
  const notes = [detail.label_caution?.trim(), shelf > 0 ? `Keeps about ${shelfText(shelf)}.` : null].filter(Boolean).join(' ');
  return {
    recipe: { id: detail.id, name: detail.name, type_id: detail.type_id, type_name: detail.type?.name ?? null },
    factor: detail.factor,
    start_date: start,
    name: `${detail.name}, ${dayName(start)}`,
    lines: detail.ingredients.map(ing => buildLine(ing, items)),
    steps: wait > 0 ? [{ title: 'Strain and bottle', due_on: addDays(start, wait) }] : [],
    prefill: {
      intention: detail.intention,
      method: detail.steps,
      base: detail.ingredients.filter(i => i.herb_id == null).map(i => i.name).join(', ') || null,
      label_notes: notes || null,
    },
  };
}

// Reading ------------------------------------------------------------------

const COVER_SQL = `(SELECT filename FROM photos p WHERE p.owner_type = 'batch' AND p.owner_id = b.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;

export function listBatches(db, f = {}) {
  const where = [];
  const args = [];
  if (f.status === 'active') where.push('b.finished_on IS NULL');
  if (f.status === 'finished') where.push('b.finished_on IS NOT NULL');
  if (str(f.recipe_id)) {
    const n = Number(f.recipe_id);
    if (!Number.isInteger(n)) throw new HttpError(400, FIX, { recipe_id: 'Must be a whole number' });
    where.push('b.recipe_id = ?'); args.push(n);
  }
  const q = str(f.q);
  if (q) {
    where.push(`(b.name LIKE ? ESCAPE '\\' OR r.name LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM batch_ingredients bi WHERE bi.batch_id = b.id AND bi.deleted_at IS NULL AND bi.name LIKE ? ESCAPE '\\'))`);
    args.push(...Array(3).fill(`%${likeEscape(q)}%`));
  }
  const rows = db.prepare(`SELECT b.id, b.name, b.recipe_id, r.name AS recipe_name, t.name AS type_name, b.start_date, b.finished_on,
      ${COVER_SQL} AS cover
    FROM batches b LEFT JOIN recipes r ON r.id = b.recipe_id AND r.deleted_at IS NULL LEFT JOIN recipe_types t ON t.id = b.type_id
    WHERE b.deleted_at IS NULL${where.map(w => ` AND ${w}`).join('')}`).all(...args);
  const steps = new Map();
  for (const s of db.prepare(`SELECT batch_id, title, due_on FROM batch_steps WHERE deleted_at IS NULL AND done_on IS NULL
    ORDER BY due_on IS NULL, due_on, sort_order, id`).all()) {
    if (!steps.has(s.batch_id)) steps.set(s.batch_id, []);
    steps.get(s.batch_id).push(s);
  }
  const out = rows.map(row => {
    const open = steps.get(row.id) ?? [];
    return { ...row, next_step: open[0] ? { title: open[0].title, due_on: open[0].due_on } : null, open_steps: open.length };
  });
  const active = out.filter(b => !b.finished_on).sort((a, b) =>
    (a.next_step?.due_on ?? '9999').localeCompare(b.next_step?.due_on ?? '9999')
    || b.start_date.localeCompare(a.start_date) || b.id - a.id);
  const done = out.filter(b => b.finished_on).sort((a, b) => b.finished_on.localeCompare(a.finished_on) || b.id - a.id);
  return [...active, ...done];
}

// The sky on the day it was started: a plain fact, shown whether or not suggestions are on.
function batchSky(db, day) {
  const s = skyFacts(day, { hemisphere: getSettings(db).hemisphere });
  return { phase: s.phase.name, sign: s.moon.sign, ruler: s.ruler };
}

export function getBatchDetail(db, id) {
  const r = repos(db);
  const batch = r.batches.get(id);
  if (!batch) throw notFound(GONE);
  const recipe = batch.recipe_id == null ? null : r.recipes.get(batch.recipe_id);
  const type = batch.type_id == null ? null : r.recipeTypes.get(batch.type_id, { includeDeleted: true });
  const getItem = db.prepare('SELECT id, name, deleted_at FROM items WHERE id = ?');
  const herbLive = db.prepare('SELECT 1 FROM herbs WHERE id = ? AND deleted_at IS NULL');
  const lines = r.batchIngredients.list({ batch_id: id }).map(line => {
    const it = line.item_id == null ? null : getItem.get(line.item_id);
    return { ...line, herb_live: line.herb_id != null && Boolean(herbLive.get(line.herb_id)), item: it ? { id: it.id, name: it.name, live: it.deleted_at == null } : null };
  });
  const steps = r.batchSteps.list({ batch_id: id });
  const made = batch.item_id == null ? null : r.items.get(batch.item_id);
  const open = steps.some(s => !s.done_on);
  return {
    ...batch,
    recipe: recipe ? { id: recipe.id, name: recipe.name } : null,
    type: type ? { id: type.id, name: type.name } : null,
    lines, steps,
    photos: r.photos.list({ owner_type: 'batch', owner_id: id }),
    made_item: made ? { id: made.id, name: made.name } : null,
    sky: batchSky(db, batch.start_date),
    status: batch.finished_on ? 'finished' : open ? 'steeping' : 'ready',
  };
}

// Writing ------------------------------------------------------------------

const isLive = (db, table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id));

function parseBatchFields(db, body, { partial }) {
  const src = isObject(body) ? body : {};
  const { data = {}, errors = {} } = validate(batchSchema, src, { partial });
  if (data.recipe_id != null && !isLive(db, 'recipes', data.recipe_id)) errors.recipe_id = "That recipe isn't in the book";
  if (data.type_id != null && !isLive(db, 'recipe_types', data.type_id)) errors.type_id = "That type doesn't exist";
  return { data, errors, src };
}

function parseLines(db, list, errors) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) { errors.lines = 'Send a list of ingredients'; return []; }
  if (list.length > MAX_LINES) { errors.lines = `Use at most ${MAX_LINES} ingredients`; return []; }
  const getItem = db.prepare('SELECT id, name, unit, amount FROM items WHERE id = ? AND deleted_at IS NULL');
  const getHerb = db.prepare('SELECT common_name FROM herbs WHERE id = ? AND deleted_at IS NULL');
  return list.map((raw, i) => {
    const res = validate(batchLineSchema, isObject(raw) ? raw : {});
    const row = res.data ?? {};
    for (const [k, msg] of Object.entries(res.errors ?? {})) errors[`lines.${i}.${k}`] = msg;
    const src = isObject(raw) ? raw : {};
    const item = row.item_id != null ? getItem.get(row.item_id) : null;
    if (row.item_id != null && !item) errors[`lines.${i}.item_id`] = "That jar isn't in the cabinet";
    if (row.drawn_amount != null && row.item_id == null && !errors[`lines.${i}.drawn_amount`]) errors[`lines.${i}.drawn_amount`] = 'Pick a jar to draw from';
    const herb = row.herb_id != null ? getHerb.get(row.herb_id) : null;
    if (row.herb_id != null && !herb) errors[`lines.${i}.herb_id`] = "That herb isn't in the grimoire";
    const typed = typeof src.name === 'string' && src.name.trim() !== '';
    const name = typed ? src.name.trim() : herb?.common_name ?? item?.name ?? null;
    if (!name && !errors[`lines.${i}.name`]) errors[`lines.${i}.name`] = 'Add a name';
    return { ...row, name, sort_order: i, item, drawn: item && row.drawn_amount != null ? row.drawn_amount : null };
  });
}

function parseSteps(list, errors) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) { errors.steps = 'Send a list of steps'; return []; }
  if (list.length > MAX_STEPS) { errors.steps = `Use at most ${MAX_STEPS} steps`; return []; }
  return list.map((raw, i) => {
    const res = validate(batchStepSchema, isObject(raw) ? raw : {});
    for (const [k, msg] of Object.entries(res.errors ?? {})) errors[`steps.${i}.${k}`] = msg;
    return { ...(res.data ?? {}), sort_order: i };
  });
}

// Finds the draws that would take a jar below zero, counting every line on the same jar together.
function shortDraws(lines) {
  const left = new Map();
  const short = [];
  lines.forEach((line, i) => {
    if (!line.item || !(line.drawn > 0)) return;
    const have = left.has(line.item.id) ? left.get(line.item.id) : line.item.amount;
    if (line.drawn - have > 1e-9) {
      short.push({ line: i, item_id: line.item.id, name: line.item.name, has: round4(have), wants: line.drawn, unit: line.item.unit });
    }
    left.set(line.item.id, Math.max(0, have - line.drawn));
  });
  return short;
}

export function createBatch(db, body) {
  const { data, errors, src } = parseBatchFields(db, body, { partial: false });
  const lines = parseLines(db, src.lines, errors);
  const steps = parseSteps(src.steps, errors);
  if (Object.keys(errors).length) throw new HttpError(400, FIX, errors);
  const r = repos(db);
  if (data.recipe_id != null && data.type_id == null) data.type_id = r.recipes.get(data.recipe_id)?.type_id ?? null;
  const short = shortDraws(lines);
  if (short.length && !(src.confirm_short === true)) {
    throw new HttpError(409, 'Some jars hold less than you are drawing.', { short });
  }
  return transaction(db, () => {
    const batch = r.batches.create(data);
    const left = new Map();
    const given = [];
    for (const line of lines) {
      const { item, drawn, ...row } = line;
      if (item && drawn > 0) {
        const have = left.has(item.id) ? left.get(item.id) : item.amount;
        const take = Math.min(drawn, have);
        row.drawn_amount = take;
        left.set(item.id, Math.max(0, have - take));
        given.push([item.id, take]);
      }
      r.batchIngredients.create({ ...row, batch_id: batch.id, drawn_unit: item && row.drawn_amount != null ? item.unit : null });
    }
    for (const step of steps) r.batchSteps.create({ ...step, batch_id: batch.id });
    for (const [itemId, take] of given) drawFromItem(db, itemId, take);
    return batch.id;
  });
}

export function updateBatch(db, id, body) {
  const r = repos(db);
  if (!r.batches.get(id)) throw notFound(GONE);
  const { data, errors } = parseBatchFields(db, body, { partial: true });
  if (Object.keys(errors).length) throw new HttpError(400, FIX, errors);
  r.batches.update(id, data);
  return id;
}

// Steps -------------------------------------------------------------------

function getStep(db, batchId, stepId, opts) {
  const step = repos(db).batchSteps.get(stepId, opts);
  if (!step || step.batch_id !== batchId) throw notFound('That step is not on this batch.');
  return step;
}

export function addStep(db, batchId, body) {
  const r = repos(db);
  if (!r.batches.get(batchId)) throw notFound(GONE);
  const data = check(batchStepSchema, body);
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM batch_steps WHERE batch_id = ? AND deleted_at IS NULL').get(batchId).n;
  return r.batchSteps.create({ sort_order: next, ...data, batch_id: batchId });
}

export function updateStep(db, batchId, stepId, body) {
  const r = repos(db);
  if (!r.batches.get(batchId)) throw notFound(GONE);
  getStep(db, batchId, stepId);
  return r.batchSteps.update(stepId, check(batchStepSchema, body, { partial: true }));
}

export function deleteStep(db, batchId, stepId) {
  if (!repos(db).batches.get(batchId)) throw notFound(GONE);
  getStep(db, batchId, stepId);
  repos(db).batchSteps.remove(stepId);
}

export function restoreStep(db, batchId, stepId) {
  if (!repos(db).batches.get(batchId)) throw notFound(GONE);
  const step = getStep(db, batchId, stepId, { includeDeleted: true });
  if (!step.deleted_at) throw notFound('Nothing to undo');
  repos(db).batchSteps.restore(stepId);
  return repos(db).batchSteps.get(stepId);
}

// Finishing ---------------------------------------------------------------

const cabinetErrors = (details = {}) => Object.fromEntries(Object.entries(details).map(([k, v]) => [`add_to_cabinet.${k}`, v]));

export function finishBatch(db, id, body) {
  const r = repos(db);
  const batch = r.batches.get(id);
  if (!batch) throw notFound(GONE);
  if (batch.finished_on) throw new HttpError(409, 'This batch is already finished.');
  const src = isObject(body) ? body : {};
  const { data, errors } = validate(finishSchema, src);
  const errs = { ...errors };
  const cab = src.add_to_cabinet;
  if (cab != null) {
    if (!isObject(cab)) errs.add_to_cabinet = 'Send the jar details';
    else {
      if (cab.unit != null && !UNITS.includes(cab.unit)) errs['add_to_cabinet.unit'] = `Pick one of: ${UNITS.join(', ')}`;
      if (cab.unit == null || cab.unit === '') errs['add_to_cabinet.unit'] = 'Pick a unit';
      if (cab.amount == null || cab.amount === '') errs['add_to_cabinet.amount'] = 'Add an amount';
    }
  }
  if (data.yield_amount === 0) errs.yield_amount = 'Must be more than 0';
  if (Object.keys(errs).length) throw new HttpError(400, FIX, errs);
  if (data.yield_amount != null && data.yield_unit == null) throw new HttpError(400, FIX, { yield_unit: 'Pick a unit for the yield' });
  if (data.expires_on === undefined) {
    const recipe = batch.recipe_id == null ? null : r.recipes.get(batch.recipe_id, { includeDeleted: true });
    const typeId = batch.type_id ?? recipe?.type_id;
    const type = typeId == null ? null : r.recipeTypes.get(typeId, { includeDeleted: true });
    const shelf = recipe?.shelf_life_days ?? type?.shelf_life_days ?? null;
    data.expires_on = shelf > 0 && isDate(data.finished_on) ? addDays(data.finished_on, shelf) : null;
  }
  transaction(db, () => {
    db.prepare(`UPDATE batch_steps SET done_on = ?, updated_at = datetime('now') WHERE batch_id = ? AND deleted_at IS NULL AND done_on IS NULL`)
      .run(data.finished_on, id);
    const changes = { ...data };
    if (cab != null) {
      try {
        const item = createItem(db, {
          name: batch.name, ...cab, source_kind: 'made', source_from: batch.name, acquired_on: data.finished_on, expires_on: data.expires_on,
        });
        changes.item_id = item.id;
      } catch (err) {
        if (err instanceof HttpError && err.status === 400) throw new HttpError(400, err.message, cabinetErrors(err.details));
        throw err;
      }
    }
    r.batches.update(id, changes);
  });
  return id;
}

export function unfinishBatch(db, id) {
  const r = repos(db);
  const batch = r.batches.get(id);
  if (!batch) throw notFound(GONE);
  if (!batch.finished_on) throw new HttpError(409, 'This batch is not finished.');
  r.batches.update(id, { finished_on: null, yield_amount: null, yield_unit: null, expires_on: null, item_id: null });
  return id;
}

// Deleting ----------------------------------------------------------------

// Never touches item amounts: the herbs were really used. Photos cascade with the same stamp.
export function deleteBatch(ctx, id, stamp) {
  const db = ctx.db;
  if (!repos(db).batches.get(id)) throw notFound(GONE);
  transaction(db, () => {
    repos(db).batches.remove(id, stamp);
    db.prepare('UPDATE batch_ingredients SET deleted_at = ? WHERE batch_id = ? AND deleted_at IS NULL').run(stamp, id);
    db.prepare('UPDATE batch_steps SET deleted_at = ? WHERE batch_id = ? AND deleted_at IS NULL').run(stamp, id);
    cascadeDeletePhotos(ctx, 'batch', id, stamp);
  });
}

export function restoreBatch(ctx, id) {
  const db = ctx.db;
  const row = repos(db).batches.get(id, { includeDeleted: true });
  if (!row || !row.deleted_at) throw notFound('Nothing to undo');
  transaction(db, () => {
    repos(db).batches.restore(id);
    db.prepare('UPDATE batch_ingredients SET deleted_at = NULL WHERE batch_id = ? AND deleted_at = ?').run(id, row.deleted_at);
    db.prepare('UPDATE batch_steps SET deleted_at = NULL WHERE batch_id = ? AND deleted_at = ?').run(id, row.deleted_at);
    cascadeRestorePhotos(ctx, 'batch', id, row.deleted_at);
  });
}

// Today -------------------------------------------------------------------

export function dueSteps(db, today, { days = 7 } = {}) {
  return db.prepare(`SELECT s.id AS step_id, s.title, s.due_on, b.id AS batch_id, b.name AS batch_name
    FROM batch_steps s JOIN batches b ON b.id = s.batch_id AND b.deleted_at IS NULL AND b.finished_on IS NULL
    WHERE s.deleted_at IS NULL AND s.done_on IS NULL AND s.due_on IS NOT NULL AND s.due_on <= ?
    ORDER BY s.due_on, s.id`).all(addDays(today, days)).map(s => ({ ...s, overdue: s.due_on < today }));
}
