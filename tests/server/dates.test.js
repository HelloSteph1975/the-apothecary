import { it, expect } from 'vitest';
import { addDays, addMonths, isDate } from '../../server/lib/dates.js';

it('adds days across month and year ends', () => {
  expect(addDays('2026-10-08', 30)).toBe('2026-11-07');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

it('adds months and clamps to the last day of short months', () => {
  expect(addMonths('2026-10-08', 12)).toBe('2027-10-08');
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  expect(addMonths('2026-08-15', 6)).toBe('2027-02-15');
});

it('recognises real dates only', () => {
  expect(isDate('2026-02-28')).toBe(true);
  expect(isDate('2026-02-30')).toBe(false);
  expect(isDate('26-2-3')).toBe(false);
});
