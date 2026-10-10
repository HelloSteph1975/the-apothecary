import { phaseText } from './calendar.js';
import { Sparkles, Moon, Sun, Cloud, Sprout, Leaf, Feather, PenLine, Flame, Flower2, Star, BookOpen } from 'lucide-react';

// Mirrors JOURNAL_ICONS and MOODS on the server (server/schemas.js); keep them in step.
const ICON_MAP = {
  sparkles: Sparkles, moon: Moon, sun: Sun, cloud: Cloud, sprout: Sprout, leaf: Leaf,
  feather: Feather, pen: PenLine, flame: Flame, flower: Flower2, star: Star, book: BookOpen,
};

export const JOURNAL_ICONS = Object.keys(ICON_MAP).map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

export const MOODS = ['joyful', 'calm', 'grateful', 'hopeful', 'tired', 'unsettled', 'sad', 'curious']
  .map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

export function TypeIcon({ icon, size = 20 }) {
  const Icon = ICON_MAP[icon] || PenLine;
  return <Icon size={size} aria-hidden="true" />;
}

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const parseDay = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };

// "Waxing gibbous in Taurus, Friday under Venus", plus ", Samhain" on a festival.
// The day (YYYY-MM-DD) names the weekday; without it the weekday is left out.
export function skyStampText(sky, day = sky?.day) {
  if (!sky || !sky.phase) return '';
  const weekday = day ? `${parseDay(day).toLocaleDateString('en-US', { weekday: 'long' })} ` : '';
  const text = `${cap(phaseText(sky.phase))} in ${sky.sign}, ${weekday}under ${sky.ruler}`;
  return sky.festival ? `${text}, ${sky.festival}` : text;
}

// "Oct 10, 9:30 PM"; the year shows when it is not this year; no time means just the date.
export function entryWhen(day, time, now = new Date()) {
  const d = parseDay(day);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  const date = d.toLocaleDateString('en-US', opts);
  if (!time) return date;
  const [h, m] = time.split(':').map(Number);
  return `${date}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
