// The sky library works in local days. Pin the zone before anything loads so
// the day boundaries below are the same on every machine.
process.env.TZ = 'America/Mexico_City';

import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import {
  localNoon, localDayBounds, phaseOn, moonSignAt, signChanges, principalPhases,
  dayRuler, festivals, nextFestival, skyForDay, skyFacts,
  SIGNS, SIGN_ELEMENTS, PHASE_NAMES, PHASE_GROUPS, RULERS, FESTIVALS,
} from '../../server/lib/sky.js';

const TEN_MIN = 10 * 60 * 1000;
const near = (iso, expectedIso) => Math.abs(new Date(iso).getTime() - new Date(expectedIso).getTime());
const local = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('local days', () => {
  it('uses local noon and midnight bounds', () => {
    const n = localNoon('2024-01-11');
    expect([n.getFullYear(), n.getMonth(), n.getDate(), n.getHours()]).toEqual([2024, 0, 11, 12]);
    const { start, end } = localDayBounds('2024-01-11');
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
    expect(end.getDate()).toBe(12);
  });
});

describe('principal phases against published times', () => {
  const find = (name, from, to) => principalPhases(new Date(from), new Date(to)).find(p => p.name === name);
  it('finds the published moons', () => {
    expect(near(find('new', '2024-01-05T00:00:00Z', '2024-01-20T00:00:00Z').at, '2024-01-11T11:57:00Z')).toBeLessThan(TEN_MIN);
    expect(near(find('full', '2024-01-20T00:00:00Z', '2024-02-01T00:00:00Z').at, '2024-01-25T17:54:00Z')).toBeLessThan(TEN_MIN);
    expect(near(find('full', '2024-09-10T00:00:00Z', '2024-09-25T00:00:00Z').at, '2024-09-18T02:34:00Z')).toBeLessThan(TEN_MIN);
    expect(near(find('new', '2024-09-25T00:00:00Z', '2024-10-10T00:00:00Z').at, '2024-10-02T18:49:00Z')).toBeLessThan(TEN_MIN);
  });
  it('lists all four phases in order across a month', () => {
    const list = principalPhases(new Date('2024-01-01T00:00:00Z'), new Date('2024-02-01T00:00:00Z'));
    expect(list.map(p => p.name)).toEqual(['last quarter', 'new', 'first quarter', 'full']);
    expect(typeof list[0].at).toBe('string');
  });
});

describe('equinoxes and solstices', () => {
  it('match published times', () => {
    const s = Astronomy.Seasons(2024);
    expect(near(s.mar_equinox.date.toISOString(), '2024-03-20T03:06:00Z')).toBeLessThan(TEN_MIN);
    expect(near(s.jun_solstice.date.toISOString(), '2024-06-20T20:51:00Z')).toBeLessThan(TEN_MIN);
    expect(near(s.dec_solstice.date.toISOString(), '2024-12-21T09:20:00Z')).toBeLessThan(TEN_MIN);
  });
});

describe('moon sign', () => {
  it('puts the 2024-01-25 full moon in Leo and the 2024-10-02 new moon in Libra', () => {
    expect(moonSignAt(new Date('2024-01-25T17:54:00Z')).sign).toBe('Leo');
    expect(moonSignAt(new Date('2024-01-25T17:54:00Z')).element).toBe('Fire');
    expect(moonSignAt(new Date('2024-10-02T18:49:00Z')).sign).toBe('Libra');
    const m = moonSignAt(new Date('2024-10-02T18:49:00Z'));
    expect(m.longitude).toBeGreaterThanOrEqual(180);
    expect(m.longitude).toBeLessThan(210);
  });
  it('finds sign changes with the new sign entered', () => {
    const changes = signChanges(new Date('2024-01-25T00:00:00Z'), new Date('2024-01-28T00:00:00Z'));
    expect(changes.length).toBeGreaterThanOrEqual(1);
    const at = new Date(changes[0].at);
    expect(moonSignAt(new Date(at.getTime() + 2 * 60000)).sign).toBe(changes[0].sign);
    expect(moonSignAt(new Date(at.getTime() - 2 * 60000)).sign).not.toBe(changes[0].sign);
  });
});

describe('phaseOn', () => {
  it('names the day with an exact full moon', () => {
    expect(phaseOn('2024-01-25')).toMatchObject({ name: 'full', group: 'full' });
  });
  it('names the new moon day', () => {
    expect(phaseOn('2024-01-11')).toMatchObject({ name: 'new', group: 'new' });
  });
  it('names days between phases', () => {
    expect(phaseOn('2024-01-14')).toMatchObject({ name: 'waxing crescent', group: 'waxing' });
    const p = phaseOn('2024-01-28');
    expect(p).toMatchObject({ name: 'waning gibbous', group: 'waning' });
    expect(p.angle).toBeGreaterThan(180);
    expect(p.angle).toBeLessThan(270);
    expect(Number.isInteger(p.illumination)).toBe(true);
    expect(p.illumination).toBeGreaterThan(50);
  });
});

describe('day ruler', () => {
  it('uses the local weekday', () => {
    expect(dayRuler('2026-10-09')).toBe('Venus');
    expect(dayRuler('2026-10-11')).toBe('Sun');
    expect(dayRuler('2026-10-12')).toBe('Moon');
  });
});

describe('festivals', () => {
  it('northern 2026', () => {
    const f = Object.fromEntries(festivals(2026, 'north').map(x => [x.name, x.day]));
    expect(f.Imbolc).toBe('2026-02-01');
    expect(f.Beltane).toBe('2026-05-01');
    expect(f.Lughnasadh).toBe('2026-08-01');
    expect(f.Samhain).toBe('2026-10-31');
    const s = Astronomy.Seasons(2026);
    expect(f.Ostara).toBe(local(s.mar_equinox.date));
    expect(f.Litha).toBe(local(s.jun_solstice.date));
    expect(f.Mabon).toBe(local(s.sep_equinox.date));
    expect(f.Yule).toBe(local(s.dec_solstice.date));
  });
  it('is in date order and flips in the south', () => {
    const north = festivals(2026, 'north');
    expect(north.map(x => x.day)).toEqual([...north.map(x => x.day)].sort());
    const f = Object.fromEntries(north.map(x => [x.name, x.day]));
    const south = Object.fromEntries(festivals(2026, 'south').map(x => [x.name, x.day]));
    expect(south.Imbolc).toBe('2026-08-01');
    expect(south.Beltane).toBe('2026-10-31');
    expect(south.Lughnasadh).toBe('2026-02-01');
    expect(south.Samhain).toBe('2026-05-01');
    expect(south.Ostara).toBe(f.Mabon);
    expect(south.Mabon).toBe(f.Ostara);
    expect(south.Litha).toBe(f.Yule);
    expect(south.Yule).toBe(f.Litha);
  });
  it('finds the next festival strictly after a day, rolling into next year', () => {
    expect(nextFestival('2026-10-09', 'north')).toEqual({ name: 'Samhain', day: '2026-10-31', in_days: 22 });
    expect(nextFestival('2026-12-30', 'north')).toEqual({ name: 'Imbolc', day: '2027-02-01', in_days: 33 });
  });
});

describe('skyForDay', () => {
  it('bundles the day', () => {
    const s = skyForDay('2026-10-31', { hemisphere: 'north' });
    expect(s.day).toBe('2026-10-31');
    expect(s.festival).toBe('Samhain');
    expect(s.ruler).toBe('Saturn');
    expect(PHASE_NAMES).toContain(s.phase.name);
    expect(Object.keys(s.phase).sort()).toEqual(['group', 'illumination', 'name']);
    expect(SIGNS).toContain(s.moon.sign);
    expect(Array.isArray(s.moon.changes)).toBe(true);
    expect(new Date(s.next_new).getTime()).toBeGreaterThan(localNoon('2026-10-31').getTime());
    expect(new Date(s.next_full).getTime()).toBeGreaterThan(localNoon('2026-10-31').getTime());
    expect(s.next_festival.in_days).toBeGreaterThan(0);
  });
  it('has a null festival on an ordinary day and honours hemisphere', () => {
    expect(skyForDay('2026-10-09', { hemisphere: 'north' }).festival).toBeNull();
    expect(skyForDay('2026-10-31', { hemisphere: 'south' }).festival).toBe('Beltane');
  });
  it('exports constants', () => {
    expect(SIGNS).toHaveLength(12);
    expect(SIGN_ELEMENTS.Scorpio).toBe('Water');
    expect(PHASE_NAMES).toHaveLength(8);
    expect(PHASE_GROUPS).toEqual(['waxing', 'full', 'waning', 'new']);
    expect(RULERS).toHaveLength(7);
    expect(FESTIVALS).toHaveLength(8);
  });
});

describe('skyFacts', () => {
  it('agrees with skyForDay on the shared fields', () => {
    for (const day of ['2024-01-11', '2024-03-20', '2024-10-31', '2026-12-21', '2026-10-10']) {
      for (const hemisphere of ['north', 'south']) {
        const full = skyForDay(day, { hemisphere });
        const lean = skyFacts(day, { hemisphere });
        expect(lean).toEqual({
          day, phase: { name: full.phase.name, group: full.phase.group },
          moon: { sign: full.moon.sign, element: full.moon.element }, ruler: full.ruler, festival: full.festival,
        });
      }
    }
  });
});
