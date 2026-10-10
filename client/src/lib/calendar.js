import { addDaysTo } from './tasks.js';

export const VIEWS = ['month', 'week', 'agenda'];
export const KINDS = [
  { kind: 'step', label: 'Batch steps' },
  { kind: 'task', label: 'Tasks' },
  { kind: 'expiry', label: 'Jars to use up' },
];
export const AGENDA_DAYS = 30;
export const MAX_SHOWN = 3;

const parts = iso => iso.split('-').map(Number);
const make = iso => { const [y, m, d] = parts(iso); return new Date(y, m - 1, d); };
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && fmt(make(v)) === v;

export const monthStart = iso => `${iso.slice(0, 7)}-01`;
export const weekStart = iso => addDaysTo(iso, -make(iso).getDay());
export const monthLabel = iso => make(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const dayLabel = iso => make(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
export const monthDayLabel = iso => make(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
export const weekdayShort = iso => make(iso).toLocaleDateString('en-US', { weekday: 'short' });

export function shiftMonth(iso, n) {
  const [y, m] = parts(iso);
  return fmt(new Date(y, m - 1 + n, 1));
}

// The first and last day the server is asked for, and the days between.
export function rangeFor(view, date) {
  let from;
  let to;
  if (view === 'week') { from = weekStart(date); to = addDaysTo(from, 6); }
  else if (view === 'agenda') { from = date; to = addDaysTo(date, AGENDA_DAYS - 1); }
  else {
    const first = monthStart(date);
    from = weekStart(first);
    const last = addDaysTo(shiftMonth(first, 1), -1);
    to = addDaysTo(weekStart(last), 6);
  }
  const days = [];
  for (let d = from; d <= to; d = addDaysTo(d, 1)) days.push(d);
  return { from, to, days };
}

export function step(view, date, n) {
  if (view === 'week') return addDaysTo(date, 7 * n);
  if (view === 'agenda') return addDaysTo(date, AGENDA_DAYS * n);
  return shiftMonth(date, n);
}

export const markerText = marker => ({ full: 'Full moon', new: 'New moon', 'first quarter': 'First quarter', 'last quarter': 'Last quarter' }[marker] ?? '');
export const badge = day => day.festival || markerText(day.marker);

export const openCount = events => events.filter(e => !e.done).length;
export const thingsDue = n => `${n} ${n === 1 ? 'thing' : 'things'} due`;

// "Friday, October 9: waxing crescent in Scorpio, 2 things due"
export function cellName(day, events) {
  const n = openCount(events);
  const extra = [day.festival, day.marker && !day.festival ? markerText(day.marker) : ''].filter(Boolean);
  return `${dayLabel(day.day)}: ${day.phase} in ${day.sign}${extra.length ? `, ${extra.join(', ')}` : ''}${n ? `, ${thingsDue(n)}` : ''}`;
}

export function byDay(events) {
  const map = new Map();
  for (const e of events) {
    if (!map.has(e.day)) map.set(e.day, []);
    map.get(e.day).push(e);
  }
  return map;
}
