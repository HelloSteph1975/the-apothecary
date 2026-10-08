import { HttpError } from '../http.js';

export const DEFAULT_SETTINGS = {
  keeper_name: '',
  location_name: 'Mexico City',
  latitude: '19.4326',
  longitude: '-99.1332',
  hemisphere: 'north',
  units: 'metric',
};

const DECIMAL = /^-?\d+(\.\d+)?$/;
const RULES = {
  keeper_name: v => v.length <= 60,
  location_name: v => v.length >= 1 && v.length <= 80,
  latitude: v => DECIMAL.test(v) && Math.abs(Number(v)) <= 90,
  longitude: v => DECIMAL.test(v) && Math.abs(Number(v)) <= 180,
  hemisphere: v => ['north', 'south'].includes(v),
  units: v => ['metric', 'us'].includes(v),
};

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const saved = Object.fromEntries(rows.filter(r => Object.hasOwn(DEFAULT_SETTINGS, r.key)).map(r => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(db, input) {
  // Null-prototype objects, so a key like "__proto__" is reported, not swallowed.
  const errors = Object.create(null);
  const clean = Object.create(null);
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!Object.hasOwn(RULES, k)) { errors[k] = 'Unknown setting'; continue; }
    const ok = typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
    const norm = ok ? String(v).trim() : '';
    if (!ok || !RULES[k](norm)) errors[k] = 'Not a valid value';
    else clean[k] = norm;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { ...errors });
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(clean)) up.run(k, v);
  return getSettings(db);
}
