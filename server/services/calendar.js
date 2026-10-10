import { addDays } from '../lib/dates.js';
import { skyFacts } from '../lib/sky.js';
import { getSettings } from './settings.js';
import { localToday } from './timing.js';
import { syncAutoTasks } from './tasks.js';

const MARKERS = ['new', 'full', 'first quarter', 'last quarter'];

// The moon, sign, ruler and festival for each day, with a marker on the four principal phases.
export function calendarDays(db, from, to) {
  const { hemisphere } = getSettings(db);
  const out = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const f = skyFacts(day, { hemisphere });
    out.push({
      day, phase: f.phase.name, sign: f.moon.sign, ruler: f.ruler, festival: f.festival,
      marker: MARKERS.includes(f.phase.name) ? f.phase.name : null,
    });
  }
  return out;
}

// Steps, tasks and jar expiries in the range. Step and expiry tasks are left out because the steps and expiry events already show.
export function calendarEvents(db, from, to, today) {
  const overdue = (day, done) => !done && day < today;
  const events = [];
  const steps = db.prepare(`SELECT s.id, s.title, s.due_on, s.done_on, b.id AS batch_id, b.name AS batch_name
    FROM batch_steps s JOIN batches b ON b.id = s.batch_id AND b.deleted_at IS NULL
    WHERE s.deleted_at IS NULL AND s.due_on BETWEEN ? AND ? AND (s.done_on IS NOT NULL OR b.finished_on IS NULL)`).all(from, to);
  for (const s of steps) {
    events.push({ kind: 'step', day: s.due_on, title: `${s.title}: ${s.batch_name}`, link: `/batches/${s.batch_id}`, done: s.done_on != null, overdue: overdue(s.due_on, s.done_on), id: s.id });
  }
  const tasks = db.prepare(`SELECT id, title, due_on, done_on FROM tasks WHERE deleted_at IS NULL AND due_on BETWEEN ? AND ?
    AND NOT (kind = 'auto' AND (auto_key LIKE 'step:%' OR auto_key LIKE 'expiry:%'))`).all(from, to);
  for (const t of tasks) {
    events.push({ kind: 'task', day: t.due_on, title: t.title, link: `/todo/${t.id}`, done: t.done_on != null, overdue: overdue(t.due_on, t.done_on), id: t.id });
  }
  const items = db.prepare(`SELECT id, name, expires_on FROM items WHERE deleted_at IS NULL AND used_up_at IS NULL AND expires_on BETWEEN ? AND ?`).all(from, to);
  for (const it of items) {
    events.push({ kind: 'expiry', day: it.expires_on, title: `Use up ${it.name}`, link: `/cabinet/items/${it.id}`, done: false, overdue: overdue(it.expires_on, false), id: it.id });
  }
  const order = { step: 0, task: 1, expiry: 2 };
  return events.sort((a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind] || a.title.localeCompare(b.title) || a.id - b.id);
}

export function calendar(db, from, to) {
  const today = localToday();
  syncAutoTasks(db, today);
  return { days: calendarDays(db, from, to), events: calendarEvents(db, from, to, today) };
}
