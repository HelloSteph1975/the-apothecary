// Sky calculations: moon phase, moon sign, day ruler and festivals.
// Pure functions. A "day" is a YYYY-MM-DD calendar day in the computer's
// local time zone; exact event times are returned as ISO UTC strings.
import * as Astronomy from 'astronomy-engine';

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const SIGN_ELEMENTS = {
  Aries: 'Fire', Taurus: 'Earth', Gemini: 'Air', Cancer: 'Water', Leo: 'Fire', Virgo: 'Earth',
  Libra: 'Air', Scorpio: 'Water', Sagittarius: 'Fire', Capricorn: 'Earth', Aquarius: 'Air', Pisces: 'Water',
};
export const PHASE_NAMES = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];
export const PHASE_GROUPS = ['waxing', 'full', 'waning', 'new'];
const GROUP_OF = {
  new: 'new', 'waxing crescent': 'waxing', 'first quarter': 'waxing', 'waxing gibbous': 'waxing',
  full: 'full', 'waning gibbous': 'waning', 'last quarter': 'waning', 'waning crescent': 'waning',
};
// Index matches Date#getDay (Sunday first).
export const RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
// Fixed dates are [month, day]; 'mar'|'jun'|'sep'|'dec' mean that equinox or solstice.
export const FESTIVALS = [
  { name: 'Imbolc', north: [2, 1], south: [8, 1] },
  { name: 'Ostara', north: 'mar', south: 'sep' },
  { name: 'Beltane', north: [5, 1], south: [10, 31] },
  { name: 'Litha', north: 'jun', south: 'dec' },
  { name: 'Lughnasadh', north: [8, 1], south: [2, 1] },
  { name: 'Mabon', north: 'sep', south: 'mar' },
  { name: 'Samhain', north: [10, 31], south: [5, 1] },
  { name: 'Yule', north: 'dec', south: 'jun' },
];

const QUARTER_NAMES = ['new', 'first quarter', 'full', 'last quarter'];
const SEASON_KEY = { mar: 'mar_equinox', jun: 'jun_solstice', sep: 'sep_equinox', dec: 'dec_solstice' };
const HOUR = 3600 * 1000;

const pad = n => String(n).padStart(2, '0');
const dayString = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = day => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`Not a day: ${day}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

export function localNoon(day) {
  const [y, m, d] = parseDay(day);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function localDayBounds(day) {
  const [y, m, d] = parseDay(day);
  return { start: new Date(y, m - 1, d, 0, 0, 0, 0), end: new Date(y, m - 1, d + 1, 0, 0, 0, 0) };
}

export function principalPhases(from, to) {
  const out = [];
  let q = Astronomy.SearchMoonQuarter(from);
  while (q.time.date.getTime() < to.getTime()) {
    out.push({ name: QUARTER_NAMES[q.quarter], at: q.time.date.toISOString() });
    q = Astronomy.NextMoonQuarter(q);
  }
  return out;
}

export function phaseOn(day) {
  const noon = localNoon(day);
  const { start, end } = localDayBounds(day);
  const angle = Astronomy.MoonPhase(noon);
  const exact = principalPhases(start, end)[0];
  const name = exact ? exact.name : namedByAngle(angle);
  const illumination = Math.round(Astronomy.Illumination(Astronomy.Body.Moon, noon).phase_fraction * 100);
  return { name, group: GROUP_OF[name], angle, illumination };
}

function namedByAngle(angle) {
  if (angle < 90) return 'waxing crescent';
  if (angle < 180) return 'waxing gibbous';
  if (angle < 270) return 'waning gibbous';
  return 'waning crescent';
}

const signIndex = date => {
  const lon = Astronomy.EclipticGeoMoon(date).lon;
  return Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
};

export function moonSignAt(date) {
  const lon = ((Astronomy.EclipticGeoMoon(date).lon % 360) + 360) % 360;
  const sign = SIGNS[Math.floor(lon / 30) % 12];
  return { sign, element: SIGN_ELEMENTS[sign], longitude: lon };
}

export function signChanges(from, to) {
  const out = [];
  let t = from.getTime();
  const end = to.getTime();
  let idx = signIndex(new Date(t));
  while (t < end) {
    const next = Math.min(t + 6 * HOUR, end);
    const nextIdx = signIndex(new Date(next));
    if (nextIdx !== idx) {
      let lo = t;
      let hi = next;
      while (hi - lo > 60000) {
        const mid = Math.floor((lo + hi) / 2);
        if (signIndex(new Date(mid)) === idx) lo = mid; else hi = mid;
      }
      out.push({ at: new Date(hi).toISOString(), sign: SIGNS[nextIdx] });
    }
    t = next;
    idx = nextIdx;
  }
  return out;
}

export function dayRuler(day) {
  return RULERS[localNoon(day).getDay()];
}

export function festivals(year, hemisphere = 'north') {
  const side = hemisphere === 'south' ? 'south' : 'north';
  const seasons = Astronomy.Seasons(year);
  const list = FESTIVALS.map(f => {
    const rule = f[side];
    const day = Array.isArray(rule)
      ? `${year}-${pad(rule[0])}-${pad(rule[1])}`
      : dayString(seasons[SEASON_KEY[rule]].date);
    return { name: f.name, day };
  });
  return list.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

const daysBetween = (a, b) => {
  const [ya, ma, da] = parseDay(a);
  const [yb, mb, db] = parseDay(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / (24 * HOUR));
};

export function nextFestival(day, hemisphere = 'north') {
  const [year] = parseDay(day);
  const found = [...festivals(year, hemisphere), ...festivals(year + 1, hemisphere)].find(f => f.day > day);
  return { name: found.name, day: found.day, in_days: daysBetween(day, found.day) };
}

export function skyForDay(day, { hemisphere = 'north' } = {}) {
  const noon = localNoon(day);
  const { start, end } = localDayBounds(day);
  const phase = phaseOn(day);
  const moon = moonSignAt(noon);
  const [year] = parseDay(day);
  const today = festivals(year, hemisphere).find(f => f.day === day);
  const ahead = to => principalPhases(noon, new Date(noon.getTime() + 40 * 24 * HOUR)).find(p => p.name === to).at;
  return {
    day,
    phase: { name: phase.name, group: phase.group, illumination: phase.illumination },
    moon: { sign: moon.sign, element: moon.element, changes: signChanges(start, end) },
    ruler: dayRuler(day),
    festival: today ? today.name : null,
    next_new: ahead('new'),
    next_full: ahead('full'),
    next_festival: nextFestival(day, hemisphere),
  };
}
