import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { check } from '../validate.js';
import { taskSchema } from '../schemas.js';
import { addDays } from '../lib/dates.js';
import { nextDue, RELATED_TYPES } from '../lib/repeat.js';
import { listItems } from './cabinet.js';
import { dueSteps } from './batches.js';
import { getSettings } from './settings.js';
import { localToday } from './timing.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from './photos.js';

const GONE = 'That task is not on the list.';
const FIX = 'Please fix the highlighted fields.';
const RELATED_TABLES = { item: ['items', 'name'], recipe: ['recipes', 'name'], batch: ['batches', 'name'], herb: ['herbs', 'common_name'] };
const AUTO_EDITABLE = ['title', 'notes', 'priority', 'snoozed_until'];
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };
const isObject = v => v && typeof v === 'object' && !Array.isArray(v);

// Automatic tasks ---------------------------------------------------------

function wantedAutoTasks(db, today) {
  const wanted = new Map();
  for (const s of dueSteps(db, today)) {
    wanted.set(`step:${s.step_id}:${s.due_on}`, { title: `${s.title}: ${s.batch_name}`, due_on: s.due_on, related_type: 'batch', related_id: s.batch_id });
  }
  const counts = new Map(db.prepare('SELECT item_id, COUNT(*) AS n FROM purchases WHERE deleted_at IS NULL GROUP BY item_id').all().map(r => [r.item_id, r.n]));
  for (const it of listItems(db, { status: 'low' }, today)) {
    wanted.set(`restock:${it.id}:${counts.get(it.id) ?? 0}`, { title: `Restock ${it.name}`, due_on: today, related_type: 'item', related_id: it.id });
  }
  for (const status of ['expiring', 'expired']) {
    for (const it of listItems(db, { status }, today)) {
      wanted.set(`expiry:${it.id}:${it.expires_on}`, { title: `Use or replace ${it.name}`, due_on: it.expires_on, related_type: 'item', related_id: it.id });
    }
  }
  return wanted;
}

// Makes the automatic tasks that should exist and removes open ones whose cause is gone. Done tasks and her own tasks stay.
// The day is trusted only within a day of the server clock, so a stray date cannot wipe or flood the list.
const clampDay = day => { const now = localToday(); return day < addDays(now, -1) ? addDays(now, -1) : day > addDays(now, 1) ? addDays(now, 1) : day; };

export function syncAutoTasks(db, given) {
  const today = clampDay(given);
  transaction(db, () => {
    const wanted = wantedAutoTasks(db, today);
    const known = new Set(db.prepare('SELECT auto_key FROM tasks WHERE auto_key IS NOT NULL').all().map(r => r.auto_key));
    const dismissed = new Set(db.prepare('SELECT auto_key FROM task_dismissals').all().map(r => r.auto_key));
    const r = repos(db);
    for (const [auto_key, row] of wanted) {
      if (!known.has(auto_key) && !dismissed.has(auto_key)) r.tasks.create({ ...row, kind: 'auto', auto_key });
    }
    const stale = db.prepare(`SELECT id, auto_key FROM tasks WHERE kind = 'auto' AND done_on IS NULL AND deleted_at IS NULL`).all()
      .filter(row => !wanted.has(row.auto_key));
    const hasPhotos = db.prepare("SELECT 1 FROM photos WHERE owner_type = 'task' AND owner_id = ? AND deleted_at IS NULL");
    for (const { id } of stale) {
      // A task with photos is finished rather than removed, so her photos stay with it.
      if (hasPhotos.get(id)) r.tasks.update(id, { done_on: today });
      else db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }
  });
}

// Reading -----------------------------------------------------------------

const COVER_SQL = `(SELECT filename FROM photos p WHERE p.owner_type = 'task' AND p.owner_id = t.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;

function parseDays(text) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v : []; } catch { return []; }
}

function shape(db, row, today) {
  let related = null;
  if (row.related_type && row.related_id != null) {
    const [table, col] = RELATED_TABLES[row.related_type];
    const rec = db.prepare(`SELECT ${col} AS name, deleted_at FROM ${table} WHERE id = ?`).get(row.related_id);
    related = { type: row.related_type, id: row.related_id, name: rec?.name ?? null, live: Boolean(rec) && rec.deleted_at == null };
  }
  return {
    id: row.id, title: row.title, notes: row.notes, due_on: row.due_on, repeat_kind: row.repeat_kind,
    repeat_days: parseDays(row.repeat_days), repeat_anchor_day: row.repeat_anchor_day, priority: row.priority,
    related, kind: row.kind, auto_key: row.auto_key, snoozed_until: row.snoozed_until, done_on: row.done_on,
    overdue: !row.done_on && row.due_on != null && row.due_on < today, cover: row.cover ?? null,
  };
}

const openRows = db => db.prepare(`SELECT t.*, ${COVER_SQL} AS cover FROM tasks t WHERE t.deleted_at IS NULL AND t.done_on IS NULL`).all();
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id - b.id;
const byDate = (a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999');
const byPriority = (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
const asleep = (row, today) => row.snoozed_until != null && row.snoozed_until > today;
const wakes = (row, today) => (asleep(row, today) ? row.snoozed_until : row.due_on);

export const VIEWS = ['today', 'upcoming', 'area', 'done'];

export function listTasks(db, view, today) {
  const out = row => shape(db, row, today);
  if (view === 'today') {
    return openRows(db)
      .filter(r => r.due_on != null && r.due_on <= today && !asleep(r, today))
      .sort((a, b) => (b.due_on < today) - (a.due_on < today) || byPriority(a, b) || byTitle(a, b))
      .map(out);
  }
  if (view === 'upcoming') {
    return openRows(db)
      .filter(r => r.due_on == null || r.due_on > today || asleep(r, today))
      .sort((a, b) => (wakes(a, today) ?? '9999').localeCompare(wakes(b, today) ?? '9999') || byPriority(a, b) || byTitle(a, b))
      .map(out);
  }
  if (view === 'area') {
    const groups = { item: [], recipe: [], batch: [], herb: [], none: [] };
    for (const r of openRows(db).sort((a, b) => byDate(a, b) || byPriority(a, b) || byTitle(a, b))) groups[r.related_type ?? 'none'].push(out(r));
    return groups;
  }
  if (view === 'done') {
    return db.prepare(`SELECT t.*, ${COVER_SQL} AS cover FROM tasks t WHERE t.deleted_at IS NULL AND t.done_on IS NOT NULL
      ORDER BY t.done_on DESC, t.updated_at DESC, t.id DESC LIMIT 100`).all().map(out);
  }
  throw new HttpError(400, FIX, { view: `Must be one of: ${VIEWS.join(', ')}` });
}

export function getTask(db, id, today = localToday()) {
  const row = db.prepare(`SELECT t.*, ${COVER_SQL} AS cover FROM tasks t WHERE t.id = ? AND t.deleted_at IS NULL`).get(id);
  if (!row) throw notFound(GONE);
  return { ...shape(db, row, today), photos: repos(db).photos.list({ owner_type: 'task', owner_id: id }) };
}

// Writing -----------------------------------------------------------------

function parseDaysInput(v, errors) {
  if (v === null || v === '') return '[]';
  if (!Array.isArray(v) || !v.every(n => Number.isInteger(n) && n >= 0 && n <= 6)) { errors.repeat_days = 'Pick days of the week'; return undefined; }
  return JSON.stringify([...new Set(v)].sort((a, b) => a - b));
}

function readFields(body, { partial }) {
  const src = isObject(body) ? body : {};
  const data = check(taskSchema, src, { partial });
  const errors = {};
  if (Object.prototype.hasOwnProperty.call(src, 'repeat_days')) {
    const days = parseDaysInput(src.repeat_days, errors);
    if (days !== undefined) data.repeat_days = days;
  }
  const today = src.today == null || src.today === '' ? localToday() : check({ today: 'date!' }, src).today;
  return { data, errors, today, src };
}

function checkRelated(db, merged, data, errors) {
  if (data.related_type === null) data.related_id = null;
  if (!('related_type' in data) && !('related_id' in data)) return;
  const { related_type: type, related_id: id } = merged;
  if (type == null && id == null) return;
  if (type == null) { errors.related_type = 'Pick what it is about'; return; }
  if (!RELATED_TYPES.includes(type)) { errors.related_type = 'Unknown kind of record'; return; }
  if (id == null) { errors.related_id = 'Pick a record'; return; }
  const [table] = RELATED_TABLES[type];
  if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id)) errors.related_id = 'That record is not there any more';
}

function applyRepeat(merged, data, today) {
  if (merged.repeat_kind !== 'none' && !merged.due_on) { data.due_on = today; merged.due_on = today; }
  data.repeat_anchor_day = merged.repeat_kind === 'monthly' ? Number(merged.due_on.slice(8, 10)) : null;
}

export function createTask(db, body) {
  const { data, errors, today } = readFields(body, { partial: false });
  const merged = { repeat_kind: 'none', related_type: null, related_id: null, ...data };
  checkRelated(db, merged, { related_type: 1, related_id: 1 }, errors);
  if (Object.keys(errors).length) throw new HttpError(400, FIX, errors);
  applyRepeat(merged, data, today);
  return repos(db).tasks.create({ ...data, kind: 'manual' }).id;
}

export function updateTask(db, id, body) {
  const r = repos(db);
  const row = r.tasks.get(id);
  if (!row) throw notFound(GONE);
  const { data, errors, today, src } = readFields(body, { partial: true });
  if (row.kind === 'auto') {
    for (const key of Object.keys(data)) {
      if (!AUTO_EDITABLE.includes(key) && data[key] !== row[key]) errors[key] = 'This task is made by the app, so this cannot be changed';
    }
    if (Object.keys(errors).length) throw new HttpError(400, FIX, errors);
    r.tasks.update(id, Object.fromEntries(AUTO_EDITABLE.filter(k => k in data).map(k => [k, data[k]])));
    return id;
  }
  const merged = { ...row, ...data };
  checkRelated(db, merged, data, errors);
  if (Object.keys(errors).length) throw new HttpError(400, FIX, errors);
  if ('repeat_kind' in data || 'due_on' in data || 'repeat_days' in src) applyRepeat(merged, data, today);
  r.tasks.update(id, data);
  return id;
}

const hemisphere = db => ({ hemisphere: getSettings(db).hemisphere });

export function completeTask(db, id, body) {
  const { today } = check({ today: 'date!' }, isObject(body) ? body : {});
  const r = repos(db);
  const task = r.tasks.get(id);
  if (!task) throw notFound(GONE);
  if (task.done_on) throw new HttpError(409, 'That task is already done.');
  return transaction(db, () => {
    const due = task.repeat_kind !== 'none' ? nextDue(task, task.due_on ?? today, hemisphere(db)) : null;
    const spawned = due ? r.tasks.create({
      title: task.title, notes: task.notes, due_on: due, repeat_kind: task.repeat_kind, repeat_days: task.repeat_days,
      repeat_anchor_day: task.repeat_anchor_day, priority: task.priority, related_type: task.related_type, related_id: task.related_id,
      kind: 'manual',
    }) : null;
    r.tasks.update(id, { done_on: today, spawned_id: spawned?.id ?? null });
    if (task.kind === 'auto' && task.auto_key?.startsWith('step:')) {
      const stepId = Number(task.auto_key.split(':')[1]);
      const step = r.batchSteps.get(stepId);
      if (step && !step.done_on) r.batchSteps.update(stepId, { done_on: today });
    }
    return { task: getTask(db, id, today), next: spawned ? getTask(db, spawned.id, today) : null };
  });
}

export function uncompleteTask(db, id) {
  const r = repos(db);
  const task = r.tasks.get(id);
  if (!task) throw notFound(GONE);
  if (!task.done_on) throw new HttpError(409, 'That task is not done.');
  transaction(db, () => {
    const next = task.spawned_id != null ? r.tasks.get(task.spawned_id) : null;
    // Only an untouched copy goes away: same title, notes and the due date the repeat rule gave it.
    if (next && !next.done_on && next.title === task.title && (next.notes ?? null) === (task.notes ?? null)
      && next.due_on === nextDue(task, task.due_on ?? task.done_on, hemisphere(db))) r.tasks.remove(next.id);
    if (task.kind === 'auto' && task.auto_key?.startsWith('step:')) {
      const stepId = Number(task.auto_key.split(':')[1]);
      const step = r.batchSteps.get(stepId);
      if (step && step.done_on === task.done_on) r.batchSteps.update(stepId, { done_on: null });
    }
    r.tasks.update(id, { done_on: null, spawned_id: null });
  });
  return getTask(db, id);
}

export function snoozeTask(db, id, body) {
  const { until, today } = check({ until: 'date!', today: 'date' }, isObject(body) ? body : {});
  const day = today ?? localToday();
  if (until <= day) throw new HttpError(400, FIX, { until: 'Pick a day after today' });
  if (!repos(db).tasks.get(id)) throw notFound(GONE);
  repos(db).tasks.update(id, { snoozed_until: until });
  return getTask(db, id, day);
}

export function dismissTask(ctx, id, body) {
  const db = ctx.db;
  const { today } = check({ today: 'date' }, isObject(body) ? body : {});
  const task = repos(db).tasks.get(id);
  if (!task) throw notFound(GONE);
  if (task.kind !== 'auto' || task.done_on) throw new HttpError(400, 'Only tasks made by the app can be dismissed.');
  transaction(db, () => {
    db.prepare('INSERT OR REPLACE INTO task_dismissals (auto_key, dismissed_on) VALUES (?, ?)').run(task.auto_key, today ?? localToday());
    const stamp = new Date().toISOString();
    repos(db).tasks.remove(id, stamp);
    cascadeDeletePhotos(ctx, 'task', id, stamp);
  });
}

export function deleteTask(ctx, id, stamp) {
  const db = ctx.db;
  if (!repos(db).tasks.get(id)) throw notFound(GONE);
  transaction(db, () => {
    repos(db).tasks.remove(id, stamp);
    cascadeDeletePhotos(ctx, 'task', id, stamp);
  });
}

export function restoreTask(ctx, id) {
  const db = ctx.db;
  const row = repos(db).tasks.get(id, { includeDeleted: true });
  if (!row || !row.deleted_at) throw notFound('Nothing to undo');
  if (row.auto_key && db.prepare('SELECT 1 FROM tasks WHERE auto_key = ? AND deleted_at IS NULL').get(row.auto_key)) {
    throw new HttpError(409, 'That task has already come back.');
  }
  transaction(db, () => {
    repos(db).tasks.restore(id);
    cascadeRestorePhotos(ctx, 'task', id, row.deleted_at);
  });
}
