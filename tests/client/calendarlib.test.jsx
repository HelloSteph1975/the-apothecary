import { it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { rangeFor, cellName, phaseText } from '../../client/src/lib/calendar.js';
import { MoonGlyph } from '../../client/src/lib/moonGlyph.jsx';

const span = r => ({ from: r.from, to: r.to, n: r.days.length });

it('builds a six-week month', () => {
  expect(span(rangeFor('month', '2026-08-15'))).toEqual({ from: '2026-07-26', to: '2026-09-05', n: 42 });
});

it('rolls December into January', () => {
  expect(span(rangeFor('month', '2026-12-10'))).toEqual({ from: '2026-11-29', to: '2027-01-02', n: 35 });
});

it('fits a month that starts on Sunday and ends on Saturday exactly', () => {
  expect(span(rangeFor('month', '2026-02-14'))).toEqual({ from: '2026-02-01', to: '2026-02-28', n: 28 });
});

it('starts on Sunday and ends on a Saturday that closes the month', () => {
  expect(span(rangeFor('month', '2026-03-20'))).toEqual({ from: '2026-03-01', to: '2026-04-04', n: 35 });
  expect(span(rangeFor('month', '2026-10-09'))).toEqual({ from: '2026-09-27', to: '2026-10-31', n: 35 });
});

it('builds the week and agenda ranges', () => {
  expect(span(rangeFor('week', '2026-10-14'))).toEqual({ from: '2026-10-11', to: '2026-10-17', n: 7 });
  expect(span(rangeFor('agenda', '2026-10-09'))).toEqual({ from: '2026-10-09', to: '2026-11-07', n: 30 });
});

it('reads full and new phases as moons in names', () => {
  expect(phaseText('full')).toBe('full moon');
  expect(phaseText('waxing crescent')).toBe('waxing crescent');
  const day = { day: '2026-10-25', phase: 'full', sign: 'Aries', festival: null, marker: 'full' };
  expect(cellName(day, [])).toBe('Sunday, October 25: full moon in Aries');
});

it('draws a different shape for each phase', () => {
  const phases = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];
  const shapes = phases.map(phase => {
    const { container, unmount } = render(<MoonGlyph phase={phase} />);
    const sig = [...container.querySelectorAll('circle,path')].map(n => `${n.getAttribute('d') ?? ''}|${n.getAttribute('fill')}|${n.getAttribute('transform') ?? ''}`).join(';');
    unmount();
    return sig;
  });
  expect(new Set(shapes).size).toBe(8);
});
