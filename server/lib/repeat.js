import { addDays } from './dates.js';
import { principalPhases, localDayBounds, nextFestival } from './sky.js';

export const REPEAT_KINDS = ['none', 'daily', 'weekly', 'monthly', 'new_moon', 'full_moon', 'festival'];
export const PRIORITIES = ['low', 'normal', 'high'];
export const RELATED_TYPES = ['item', 'recipe', 'batch', 'herb'];

const parse = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const pad = n => String(n).padStart(2, '0');
const weekday = s => { const { y, m, d } = parse(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const localDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function weekdays(task) {
  let list = task.repeat_days;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
  return Array.isArray(list) ? list.filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : [];
}

function nextMonthly(task, fromDay) {
  const { y, m, d } = parse(fromDay);
  const anchor = Number.isInteger(task.repeat_anchor_day) ? task.repeat_anchor_day : d;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // last day of the next month
  return new Date(Date.UTC(y, m, Math.min(anchor, lastDay))).toISOString().slice(0, 10);
}

function nextMoon(name, fromDay) {
  const { end } = localDayBounds(fromDay);
  const to = new Date(end.getTime() + 40 * 86400000);
  const hit = principalPhases(end, to).find(p => p.name === name);
  return hit ? localDay(new Date(hit.at)) : null;
}

// The first date strictly after fromDay. fromDay is the task's due date, or today when it has none.
export function nextDue(task, fromDay, { hemisphere = 'north' } = {}) {
  switch (task.repeat_kind) {
    case 'daily': return addDays(fromDay, 1);
    case 'weekly': {
      const days = weekdays(task);
      if (!days.length) return addDays(fromDay, 7);
      for (let i = 1; i <= 7; i++) if (days.includes(weekday(addDays(fromDay, i)))) return addDays(fromDay, i);
      return addDays(fromDay, 7);
    }
    case 'monthly': return nextMonthly(task, fromDay);
    case 'new_moon': return nextMoon('new', fromDay);
    case 'full_moon': return nextMoon('full', fromDay);
    case 'festival': return nextFestival(fromDay, hemisphere).day;
    default: return null;
  }
}
