// Sky wording and the choices a timing rule can name. The lists mirror the server (server/lib/sky.js
// and server/schemas.js); keep them in step.
export const FOLK_LABEL = 'Folk tradition';

export const PHASE_GROUPS = ['waxing', 'full', 'waning', 'new'];
export const PHASE_NAMES = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];
export const ELEMENTS = ['Fire', 'Water', 'Air', 'Earth'];
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const FESTIVAL_NAMES = ['Imbolc', 'Ostara', 'Beltane', 'Litha', 'Lughnasadh', 'Mabon', 'Samhain', 'Yule'];

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const RULE_KINDS = [
  { value: 'phase_group', label: 'Moon phase group', values: PHASE_GROUPS },
  { value: 'phase', label: 'Exact moon phase', values: PHASE_NAMES },
  { value: 'moon_element', label: 'Moon in an element', values: ELEMENTS },
  { value: 'moon_sign', label: 'Moon in a sign', values: SIGNS },
  { value: 'day_ruler', label: 'Day ruler', values: PLANETS },
  { value: 'festival', label: 'Festival', values: FESTIVAL_NAMES },
];

export const valueOptions = kind => (RULE_KINDS.find(k => k.value === kind)?.values ?? []).map(v => ({ value: v, label: cap(v) }));

export const WEIGHTS = [
  { value: '1', label: 'Light' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Strong' },
];
export const weightText = w => WEIGHTS.find(x => x.value === String(w))?.label ?? 'Medium';

// A short name for what a rule is about, e.g. "Moon in a water sign".
export function ruleTitle({ kind, value }) {
  switch (kind) {
    case 'phase_group': return `${cap(value)} moon`;
    case 'phase': return `${cap(value)} moon`;
    case 'moon_element': return `Moon in a ${value.toLowerCase()} sign`;
    case 'moon_sign': return `Moon in ${value}`;
    case 'day_ruler': return `Day ruled by ${value}`;
    case 'festival': return `Around ${value}`;
    default: return value;
  }
}

// Starter recipe types carry a slug; her own types don't, so build one from the name.
// Mirrors typeKey in server/lib/slugify.js; the server matches rules by the same key.
export const slugOf = type => type.slug || type.name.trim().toLowerCase().replace(/\s+/g, '-');

export const phaseText = phase => `${cap(phase.name)}, ${phase.illumination}% lit`;

const weekday = day => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
};
export const skyLine = sky => `${cap(sky.phase.name)} in ${sky.moon.sign}, ${weekday(sky.day)} under ${sky.ruler}`;

// Local clock time like "3:12 PM", with plain spaces.
export function clockTime(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Local "Sat, Oct 17, 2:31 PM".
export function moonTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date}, ${clockTime(iso)}`;
}

export function nextMoonText(sky) {
  const full = new Date(sky.next_full) <= new Date(sky.next_new);
  return `Next ${full ? 'full' : 'new'} moon ${moonTime(full ? sky.next_full : sky.next_new)}`;
}

export function festivalText(sky) {
  if (sky.festival) return `Today is ${sky.festival}`;
  const n = sky.next_festival;
  if (!n) return '';
  return `${n.name} in ${n.in_days} ${n.in_days === 1 ? 'day' : 'days'}`;
}
