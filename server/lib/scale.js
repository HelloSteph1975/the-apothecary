import { HttpError } from '../http.js';

const WHOLE_UNITS = new Set(['drops', 'count']);
const MIN = 0.01;
const MAX = 100;

const round = (n, places) => { const f = 10 ** places; return Math.round((n + Number.EPSILON) * f) / f; };

export function roundAmount(n, unit) {
  if (WHOLE_UNITS.has(unit) && n > 0) return Math.max(1, Math.round(n));
  if (n >= 100) return Math.round(n);
  if (n >= 10) return round(n, 1);
  return round(n, 2);
}

export function scaleAmount(amount, factor, unit) {
  if (amount == null) return null;
  return roundAmount(amount * factor, unit);
}

const bad = (field, message) => new HttpError(400, 'Please fix the highlighted fields.', { [field]: message });
const given = v => (typeof v === 'string' && v.trim() !== '') || typeof v === 'number';
const inRange = n => Number.isFinite(n) && n >= MIN && n <= MAX;

// The multiplier for a recipe page: ?scale=2 directly, or ?yield=500 against the recipe's own yield. Scale wins if both come.
export function factorFor(recipe, query = {}) {
  if (given(query.scale)) {
    const n = Number(query.scale);
    if (!inRange(n)) throw bad('scale', `Use a number from ${MIN} to ${MAX}`);
    return n;
  }
  if (given(query.yield)) {
    if (!(recipe?.yield_amount > 0)) throw bad('yield', 'This recipe has no yield to scale from');
    const n = Number(query.yield);
    if (!Number.isFinite(n) || n <= 0) throw bad('yield', 'Must be a number above 0');
    const factor = n / recipe.yield_amount;
    if (!inRange(factor)) throw bad('yield', `Pick an amount from ${MIN} to ${MAX} times the recipe`);
    return factor;
  }
  return 1;
}
