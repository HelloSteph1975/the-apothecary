import { it, expect } from 'vitest';
import { greeting, longDate } from '../../client/src/lib/dates.js';

it('greets by time of day', () => {
  expect(greeting(new Date(2026, 9, 8, 6))).toBe('Good morning');
  expect(greeting(new Date(2026, 9, 8, 11, 59))).toBe('Good morning');
  expect(greeting(new Date(2026, 9, 8, 12))).toBe('Good afternoon');
  expect(greeting(new Date(2026, 9, 8, 17, 59))).toBe('Good afternoon');
  expect(greeting(new Date(2026, 9, 8, 18))).toBe('Good evening');
  expect(greeting(new Date(2026, 9, 8, 2))).toBe('Good evening');
});

it('writes the date out in full', () => {
  expect(longDate(new Date(2026, 9, 8))).toBe('Thursday, October 8');
});
