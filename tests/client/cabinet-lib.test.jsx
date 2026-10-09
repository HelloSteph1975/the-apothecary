import { it, expect } from 'vitest';
import { formatShortDay, formatAmount, formatMoney, statusBadges, sourceText, UNITS } from '../../client/src/lib/cabinet.js';
import { todayString } from '../../client/src/lib/today.js';

it('formats amounts and money', () => {
  expect(formatAmount(24, 'count')).toBe('24');
  expect(formatAmount(1.5, 'l')).toBe('1.5 L');
  expect(formatAmount(250, 'ml')).toBe('250 ml');
  expect(formatAmount(2.3333, 'oz')).toBe('2.33 oz');
  expect(formatMoney(18)).toBe('$18.00');
  expect(UNITS.find(u => u.value === 'l').label).toBe('L');
  expect(UNITS.map(u => u.label)).toEqual(['g', 'kg', 'oz', 'lb', 'ml', 'L', 'fl oz', 'Count']);
});

it('describes status and source in plain words', () => {
  expect(statusBadges({ low: true, expiring: false, expired: true }).map(b => b.label)).toEqual(['Running low', 'Past its best']);
  expect(sourceText({ source_kind: 'bought', last_supplier_name: 'Moonvale' })).toBe('Bought from Moonvale');
  expect(sourceText({ source_kind: 'bought' })).toBe('Bought');
  expect(sourceText({ source_kind: 'foraged', source_place: 'the river path' })).toBe('Foraged at the river path');
  expect(sourceText({ source_kind: 'gifted', source_from: 'Rowan' })).toBe('Gifted by Rowan');
  expect(sourceText({ source_kind: null })).toBe('');
});

it('gives today in local time', () => {
  expect(todayString(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
});

it('safeUrl only passes http and https addresses', async () => {
  const { safeUrl } = await import('../../client/src/lib/cabinet.js');
  expect(safeUrl(' https://a.com ')).toBe('https://a.com');
  expect(safeUrl('HTTP://a.com')).toBe('HTTP://a.com');
  expect(safeUrl('javascript:alert(1)')).toBeNull();
  expect(safeUrl('example.com')).toBeNull();
  expect(safeUrl(null)).toBeNull();
});

it('formats a short month and day', () => {
  expect(formatShortDay('2026-10-20')).toBe('Oct 20');
  expect(formatShortDay('')).toBe('');
});
