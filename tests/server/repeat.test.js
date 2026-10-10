// Moon and day maths use local days; pin the zone like sky.test.js does.
process.env.TZ = 'America/Mexico_City';

import { describe, it, expect } from 'vitest';
import { nextDue, REPEAT_KINDS, PRIORITIES, RELATED_TYPES } from '../../server/lib/repeat.js';
import { festivals } from '../../server/lib/sky.js';

const t = (repeat_kind, extra = {}) => ({ repeat_kind, repeat_days: [], ...extra });

describe('nextDue', () => {
  it('exports the allowed values', () => {
    expect(REPEAT_KINDS).toEqual(['none', 'daily', 'weekly', 'monthly', 'new_moon', 'full_moon', 'festival']);
    expect(PRIORITIES).toEqual(['low', 'normal', 'high']);
    expect(RELATED_TYPES).toEqual(['item', 'recipe', 'batch', 'herb']);
  });
  it('none gives null and daily adds a day', () => {
    expect(nextDue(t('none'), '2026-10-10')).toBeNull();
    expect(nextDue(t('daily'), '2026-12-31')).toBe('2027-01-01');
  });
  it('weekly picks the next listed weekday, across a week end', () => {
    // 2026-10-10 is a Saturday (6). Days Mon (1) and Wed (3).
    expect(nextDue(t('weekly', { repeat_days: [1, 3] }), '2026-10-10')).toBe('2026-10-12');
    expect(nextDue(t('weekly', { repeat_days: [1, 3] }), '2026-10-12')).toBe('2026-10-14');
    expect(nextDue(t('weekly', { repeat_days: [1, 3] }), '2026-10-14')).toBe('2026-10-19');
    expect(nextDue(t('weekly', { repeat_days: '[6]' }), '2026-10-10')).toBe('2026-10-17');
  });
  it('weekly with no days is the same weekday next week', () => {
    expect(nextDue(t('weekly'), '2026-10-10')).toBe('2026-10-17');
    expect(nextDue({ repeat_kind: 'weekly' }, '2026-10-10')).toBe('2026-10-17');
  });
  it('monthly clamps to short months and returns to the anchor day', () => {
    const m = { repeat_anchor_day: 31 };
    expect(nextDue(t('monthly', m), '2027-01-31')).toBe('2027-02-28');
    expect(nextDue(t('monthly', m), '2027-02-28')).toBe('2027-03-31');
    expect(nextDue(t('monthly', m), '2028-01-31')).toBe('2028-02-29');
    expect(nextDue(t('monthly', m), '2027-04-30')).toBe('2027-05-31');
    expect(nextDue(t('monthly', m), '2026-12-31')).toBe('2027-01-31');
  });
  it('monthly without an anchor uses the day of fromDay', () => {
    expect(nextDue(t('monthly'), '2026-10-15')).toBe('2026-11-15');
  });
  it('new and full moon find the next exact moon after the day', () => {
    // New 2024-01-11 11:57Z, full 2024-01-25 17:54Z; local days in Mexico City.
    expect(nextDue(t('new_moon'), '2024-01-05')).toBe('2024-01-11');
    expect(nextDue(t('new_moon'), '2024-01-11')).toBe('2024-02-09');
    expect(nextDue(t('full_moon'), '2024-01-20')).toBe('2024-01-25');
    expect(nextDue(t('full_moon'), '2024-09-10')).toBe('2024-09-17');
    expect(nextDue(t('new_moon'), '2024-09-25')).toBe('2024-10-02');
  });
  it('festival crosses the year end in both hemispheres', () => {
    for (const hemisphere of ['north', 'south']) {
      const thisYear = festivals(2026, hemisphere);
      const last = thisYear[thisYear.length - 1].day;
      const expected = festivals(2027, hemisphere)[0].day;
      expect(expected.startsWith('2027')).toBe(true);
      expect(nextDue(t('festival'), last, { hemisphere })).toBe(expected);
      expect(nextDue(t('festival'), thisYear[0].day, { hemisphere })).toBe(thisYear[1].day);
    }
  });
});
