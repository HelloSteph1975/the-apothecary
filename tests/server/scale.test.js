import { it, expect } from 'vitest';
import { roundAmount, scaleAmount, factorFor } from '../../server/lib/scale.js';

const err = fn => { try { fn(); } catch (e) { return e; } return null; };

it('rounds by size: whole from 100, one decimal from 10, two below', () => {
  expect(roundAmount(123.456, 'g')).toBe(123);
  expect(roundAmount(100, 'ml')).toBe(100);
  expect(roundAmount(12.345, 'g')).toBe(12.3);
  expect(roundAmount(10, 'g')).toBe(10);
  expect(roundAmount(1.23456, 'tsp')).toBe(1.23);
  expect(roundAmount(0.004, 'g')).toBe(0);
  expect(roundAmount(2.5, 'parts')).toBe(2.5);
});

it('rounds drops and counts to whole numbers, never below 1 when there is any', () => {
  expect(roundAmount(7.6, 'drops')).toBe(8);
  expect(roundAmount(0.2, 'drops')).toBe(1);
  expect(roundAmount(0.4, 'count')).toBe(1);
  expect(roundAmount(2.4, 'count')).toBe(2);
  expect(roundAmount(0, 'drops')).toBe(0);
});

it('scales amounts and keeps null as null', () => {
  expect(scaleAmount(null, 2, 'g')).toBeNull();
  expect(scaleAmount(30, 2, 'g')).toBe(60);
  expect(scaleAmount(10, 0.5, 'drops')).toBe(5);
  expect(scaleAmount(3, 1 / 3, 'g')).toBe(1);
  expect(scaleAmount(1, 1 / 3, 'tsp')).toBe(0.33);
});

it('works out the factor from scale or from a target yield', () => {
  const recipe = { yield_amount: 200, yield_unit: 'ml' };
  expect(factorFor(recipe, {})).toBe(1);
  expect(factorFor(recipe, { scale: '2' })).toBe(2);
  expect(factorFor(recipe, { scale: '0.5' })).toBe(0.5);
  expect(factorFor(recipe, { yield: '50' })).toBe(0.25);
  expect(factorFor(recipe, { scale: '' })).toBe(1);
});

it('refuses a scale out of range or not a number', () => {
  for (const scale of ['0', '0.001', '101', 'abc', '-1']) {
    const e = err(() => factorFor({ yield_amount: 10 }, { scale }));
    expect(e?.status).toBe(400);
    expect(e.details.scale).toBeTruthy();
  }
  expect(factorFor({}, { scale: '100' })).toBe(100);
  expect(factorFor({}, { scale: '0.01' })).toBe(0.01);
});

it('needs a recipe yield to scale by yield, and keeps that factor in range', () => {
  let e = err(() => factorFor({ yield_amount: null }, { yield: '50' }));
  expect(e?.status).toBe(400);
  expect(e.details.yield).toBeTruthy();
  e = err(() => factorFor({ yield_amount: 10 }, { yield: '5000' }));
  expect(e.details.yield).toBeTruthy();
  e = err(() => factorFor({ yield_amount: 10 }, { yield: 'lots' }));
  expect(e.details.yield).toBeTruthy();
});
