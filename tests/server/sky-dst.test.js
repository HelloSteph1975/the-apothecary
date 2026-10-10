process.env.TZ = 'America/New_York';

import { it, expect } from 'vitest';
import { localDayBounds, phaseOn, signChanges, nextFestival, skyForDay } from '../../server/lib/sky.js';

const HOUR = 3600000;
const hours = day => { const b = localDayBounds(day); return (b.end - b.start) / HOUR; };

it('runs in the New York time zone', () => {
  expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(240);
});

it('has a 23 hour day when clocks spring forward and a 25 hour day when they fall back', () => {
  expect(hours('2026-03-08')).toBe(23);
  expect(hours('2026-11-01')).toBe(25);
  expect(hours('2026-03-09')).toBe(24);
});

it('names a phase on the change days', () => {
  for (const day of ['2026-03-08', '2026-11-01']) {
    const p = phaseOn(day);
    expect(p.name).toBeTruthy();
    expect(['waxing', 'full', 'waning', 'new']).toContain(p.group);
    expect(skyForDay(day).phase).toMatchObject({ name: p.name, group: p.group, illumination: p.illumination });
  }
});

it('tiles sign changes across the change days with no duplicates or gaps', () => {
  for (const [first, second, third] of [['2026-03-07', '2026-03-08', '2026-03-09'], ['2026-10-31', '2026-11-01', '2026-11-02']]) {
    const days = [first, second, third].map(d => signChanges(localDayBounds(d).start, localDayBounds(d).end));
    const whole = signChanges(localDayBounds(first).start, localDayBounds(third).end);
    const flat = days.flat();
    expect(flat.map(c => c.sign)).toEqual(whole.map(c => c.sign));
    flat.forEach((c, i) => expect(Math.abs(new Date(c.at) - new Date(whole[i].at))).toBeLessThanOrEqual(60000));
    const times = whole.map(c => c.at);
    expect(new Set(times).size).toBe(times.length);
    for (let i = 1; i < whole.length; i++) expect(whole[i].sign).not.toBe(whole[i - 1].sign);
  }
});

it('finds the next festival across the new year in either hemisphere', () => {
  expect(nextFestival('2026-12-31', 'north')).toMatchObject({ name: 'Imbolc', day: '2027-02-01' });
  expect(nextFestival('2026-12-31', 'south')).toMatchObject({ name: 'Lughnasadh', day: '2027-02-01' });
});
