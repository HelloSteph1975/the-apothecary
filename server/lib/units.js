import { roundAmount } from './scale.js';

// Each unit's size in its family's base unit (g for mass, ml for volume). Cups are US cups.
// count, drops and parts have no family: they only convert to themselves. Mass and volume never mix (no density guesses).
export const UNIT_FAMILIES = {
  mass: { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 },
  volume: { ml: 1, l: 1000, 'fl oz': 29.5735, tsp: 4.92892, tbsp: 14.7868, cup: 236.588 },
};

export function unitFamily(unit) {
  for (const [family, units] of Object.entries(UNIT_FAMILIES)) {
    if (Object.hasOwn(units, unit)) return family;
  }
  return null;
}

// The amount in the target unit, or null when the app can't convert it.
export function convert(amount, from, to) {
  if (from === to) return amount;
  const family = unitFamily(from);
  if (!family || family !== unitFamily(to)) return null;
  const sizes = UNIT_FAMILIES[family];
  return roundAmount(amount * sizes[from] / sizes[to], to);
}
