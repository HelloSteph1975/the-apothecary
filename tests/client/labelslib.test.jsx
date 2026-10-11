import { it, expect } from 'vitest';
import { layoutSheets, madeText, useByText } from '../../client/src/lib/labels.js';
import { LABEL_SIZES } from '../../server/services/labelSizes.js';

const a = { name: 'A', copies: 1 };
const b = { name: 'B', copies: 3 };
const c = { name: 'C', copies: 1 };
const used = sheet => sheet.map((s, i) => (s ? `${i}:${s.label.name}` : null)).filter(Boolean);

it('formats the made and use-by lines', () => {
  expect(madeText('2026-10-11')).toBe('Made Oct 11, 2026');
  expect(useByText('2027-04-11')).toBe('Use by Apr 11, 2027');
});

it('returns no sheets when there is nothing to print', () => {
  expect(layoutSheets(LABEL_SIZES[0], 1, [])).toEqual([]);
});

it.each(LABEL_SIZES)('$key: every sheet has perSheet entries, slots in order, copies in a row', size => {
  const sheets = layoutSheets(size, 1, [a, b, c]);
  expect(sheets).toHaveLength(1);
  expect(sheets[0]).toHaveLength(size.perSheet);
  expect(used(sheets[0])).toEqual(['0:A', '1:B', '2:B', '3:B', '4:C']);
  expect(sheets[0][3]).toEqual({ slot: 3, label: b });
  expect(sheets[0][5]).toBeNull();
});

it.each(LABEL_SIZES)('$key: start skips slots on the first sheet only', size => {
  const many = { name: 'M', copies: size.perSheet + 2 };
  const sheets = layoutSheets(size, 3, [many]);
  expect(sheets).toHaveLength(2);
  expect(sheets[0][0]).toBeNull();
  expect(sheets[0][1]).toBeNull();
  expect(sheets[0][2].slot).toBe(2);
  expect(sheets[0].filter(Boolean)).toHaveLength(size.perSheet - 2);
  expect(sheets[1].filter(Boolean)).toHaveLength(4);
  expect(sheets[1][0].slot).toBe(0);
});

it.each(LABEL_SIZES)('$key: a full sheet makes one page and one more label makes two', size => {
  expect(layoutSheets(size, 1, [{ name: 'F', copies: size.perSheet }])).toHaveLength(1);
  expect(layoutSheets(size, 1, [{ name: 'F', copies: size.perSheet + 1 }])).toHaveLength(2);
});

it.each(LABEL_SIZES)('$key: starting at the last slot puts one label there and the rest on page two', size => {
  const sheets = layoutSheets(size, size.perSheet, [{ name: 'L', copies: 2 }]);
  expect(sheets).toHaveLength(2);
  expect(sheets[0].filter(Boolean)).toHaveLength(1);
  expect(sheets[0][size.perSheet - 1]).not.toBeNull();
  expect(sheets[1][0].slot).toBe(0);
});

it('treats a missing copies value as one', () => {
  expect(used(layoutSheets(LABEL_SIZES[1], 1, [{ name: 'X' }])[0])).toEqual(['0:X']);
});
