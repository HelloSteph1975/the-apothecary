import { it, expect } from 'vitest';
import { UNIT_FAMILIES, unitFamily, convert } from '../../server/lib/units.js';
import { roundAmount } from '../../server/lib/scale.js';

const SIZE = {
  mass: { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 },
  volume: { ml: 1, l: 1000, 'fl oz': 29.5735, tsp: 4.92892, tbsp: 14.7868, cup: 236.588 },
};

it('names the families', () => {
  expect(Object.keys(UNIT_FAMILIES.mass)).toEqual(Object.keys(SIZE.mass));
  expect(Object.keys(UNIT_FAMILIES.volume)).toEqual(Object.keys(SIZE.volume));
  expect(unitFamily('kg')).toBe('mass');
  expect(unitFamily('cup')).toBe('volume');
  for (const u of ['count', 'drops', 'parts', 'nope', null, undefined]) expect(unitFamily(u)).toBeNull();
});

it('converts every pair in each family', () => {
  for (const fam of Object.keys(SIZE)) {
    for (const from of Object.keys(SIZE[fam])) {
      for (const to of Object.keys(SIZE[fam])) {
        const expected = roundAmount(100 * SIZE[fam][from] / SIZE[fam][to], to);
        expect(convert(100, from, to), `${from} -> ${to}`).toBe(from === to ? 100 : expected);
      }
    }
  }
  expect(convert(1, 'kg', 'g')).toBe(1000);
  expect(convert(1, 'lb', 'oz')).toBe(16);
  expect(convert(1, 'cup', 'tbsp')).toBe(16);
});

it('round trips stay close', () => {
  for (const fam of Object.keys(SIZE)) {
    for (const a of Object.keys(SIZE[fam])) {
      for (const b of Object.keys(SIZE[fam])) {
        const back = convert(convert(1000, a, b), b, a);
        expect(Math.abs(back - 1000) / 1000).toBeLessThan(0.02);
      }
    }
  }
});

it('never converts mass to volume or across families', () => {
  expect(convert(5, 'g', 'ml')).toBeNull();
  expect(convert(5, 'cup', 'oz')).toBeNull();
  expect(convert(5, 'g', 'count')).toBeNull();
  expect(convert(5, 'ml', 'drops')).toBeNull();
});

it('count, drops and parts only match themselves', () => {
  for (const u of ['count', 'drops', 'parts']) {
    expect(convert(7, u, u)).toBe(7);
    for (const other of ['count', 'drops', 'parts', 'g', 'ml']) if (other !== u) expect(convert(7, u, other)).toBeNull();
  }
  expect(convert(5, 'bogus', 'g')).toBeNull();
});

it('rounds by the target unit', () => {
  expect(convert(1, 'oz', 'g')).toBe(28.3);
  expect(convert(1, 'g', 'oz')).toBe(0.04);
  expect(convert(1, 'tsp', 'ml')).toBe(4.93);
  expect(convert(1, 'l', 'ml')).toBe(1000);
});
