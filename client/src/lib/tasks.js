import { formatDay } from './cabinet.js';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const REPEAT_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'new_moon', label: 'Every new moon' },
  { value: 'full_moon', label: 'Every full moon' },
  { value: 'festival', label: 'Each festival' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

export const RELATED_OPTIONS = [
  { value: 'item', label: 'A jar' },
  { value: 'recipe', label: 'A recipe' },
  { value: 'batch', label: 'A batch' },
  { value: 'herb', label: 'An herb' },
];

const ordinal = n => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
};

function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// 'Every Monday and Thursday', or '' when the task does not repeat.
export function repeatText(task) {
  switch (task.repeat_kind) {
    case 'daily': return 'Every day';
    case 'weekly': {
      const days = [...new Set(task.repeat_days ?? [])].filter(n => n >= 0 && n <= 6).sort((a, b) => a - b);
      return days.length ? `Every ${joinNames(days.map(n => WEEKDAYS[n]))}` : 'Every week';
    }
    case 'monthly': {
      const day = task.repeat_anchor_day ?? (task.due_on ? Number(task.due_on.slice(8, 10)) : null);
      return day ? `Every month on the ${ordinal(day)}` : 'Every month';
    }
    case 'new_moon': return 'Every new moon';
    case 'full_moon': return 'Every full moon';
    case 'festival': return 'Each festival';
    default: return '';
  }
}

export function priorityText(priority) {
  return { high: 'High priority', low: 'Low priority' }[priority] ?? 'Normal priority';
}

const ROUTES = { item: '/cabinet/items', recipe: '/recipes', batch: '/batches', herb: '/grimoire' };
export const relatedLink = related => (related && ROUTES[related.type] ? `${ROUTES[related.type]}/${related.id}` : null);

export const AREAS = [
  { key: 'item', label: 'Jars' },
  { key: 'recipe', label: 'Recipes' },
  { key: 'batch', label: 'Batches' },
  { key: 'herb', label: 'Herbs' },
  { key: 'none', label: 'Other' },
];

export function addDaysTo(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// 'Oct 3' for this year, 'Oct 3, 2027' for another.
export function shortDay(iso, today) {
  const full = formatDay(iso);
  return iso.slice(0, 4) === today.slice(0, 4) ? full.replace(/, \d{4}$/, '') : full;
}

// { text, overdue } for a task's due date.
export function dueLabel(task, today) {
  if (!task.due_on) return { text: 'No date', overdue: false };
  if (task.due_on === today) return { text: 'Today', overdue: false };
  if (task.due_on === addDaysTo(today, 1)) return { text: 'Tomorrow', overdue: false };
  if (task.due_on < today && !task.done_on) return { text: `Overdue since ${shortDay(task.due_on, today)}`, overdue: true };
  return { text: shortDay(task.due_on, today), overdue: false };
}
