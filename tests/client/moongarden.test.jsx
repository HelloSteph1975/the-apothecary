import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';

const day = (d, score = 3, over = {}) => ({
  day: d, score, sky: { phase: 'full', sign: 'Aries', ruler: 'Venus' },
  reasons: ['Full moon: traditionally a good time to gather leaves and flowers.', 'Friday, under Venus: a traditional day for gathering flowers.'], ...over,
});
const ok = body => new Response(JSON.stringify(body), { status: 200 });
let suggestions;
let calls;
beforeEach(() => {
  calls = [];
  suggestions = () => ok({ off: false, tasks: [] });
  global.fetch = vi.fn(async url => {
    calls.push(url);
    if (url === '/api/health') return ok({ ok: true, demo: false });
    if (url === '/api/settings') return ok({ keeper_name: '' });
    if (url.startsWith('/api/garden/plants')) return ok([]);
    if (url.startsWith('/api/garden/suggestions')) return suggestions();
    return ok({});
  });
});
const open = () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/garden'] });
  render(<RouterProvider router={router} />);
};

it('lists days by task with links to the calendar and reasons in the title', async () => {
  suggestions = () => ok({
    off: false,
    tasks: [
      { task: 'harvest-above', days: [day('2026-10-16'), day('2026-10-17', 2, { sky: { phase: 'waxing gibbous', sign: 'Taurus', ruler: 'Mars' } })] },
      { task: 'weed', days: [day('2026-10-20', 1, { sky: { phase: 'new', sign: 'Pisces', ruler: 'Mars' }, reasons: ['New moon: a resting time.'] })] },
    ],
  });
  open();
  expect(await screen.findByRole('heading', { name: 'By the moon, the next four weeks' })).toBeInTheDocument();
  expect(calls.some(c => c.startsWith('/api/garden/suggestions'))).toBe(true);
  expect(screen.getByText('Folk tradition, for interest. Your soil and weather know best.')).toBeInTheDocument();
  expect(screen.getByText('Gather leaves and flowers')).toBeInTheDocument();
  expect(screen.getByText('Weed and tend')).toBeInTheDocument();
  const chip = screen.getByRole('link', { name: 'Fri Oct 16, full moon in Aries' });
  expect(chip).toHaveAttribute('href', '/calendar/2026-10-16');
  expect(chip.getAttribute('title')).toContain('Full moon: traditionally a good time');
  expect(chip.getAttribute('title')).toContain('Friday, under Venus');
  expect(screen.getByRole('link', { name: 'Sat Oct 17, waxing gibbous in Taurus' })).toHaveAttribute('href', '/calendar/2026-10-17');
  expect(screen.getByRole('link', { name: 'Tue Oct 20, new moon in Pisces' })).toBeInTheDocument();
});

it('says so when suggestions are turned off', async () => {
  suggestions = () => ok({ off: true, tasks: [] });
  open();
  const line = await screen.findByText(/Moon suggestions are turned off in/);
  expect(within(line).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
});

it('shows an error with Try again', async () => {
  suggestions = () => new Response(JSON.stringify({ error: 'The sky is cloudy' }), { status: 500 });
  open();
  expect(await screen.findByText('The sky is cloudy')).toBeInTheDocument();
  suggestions = () => ok({ off: false, tasks: [{ task: 'prune', days: [day('2026-10-16')] }] });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Prune')).toBeInTheDocument();
});

it('shows the days in date order whatever order the server sends them in', async () => {
  suggestions = () => ok({ off: false, tasks: [{ task: 'weed', days: [day('2026-10-24'), day('2026-10-18'), day('2026-10-21')] }] });
  open();
  await screen.findByText('Weed and tend');
  const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href')).filter(h => h.startsWith('/calendar/'));
  expect(hrefs).toEqual(['/calendar/2026-10-18', '/calendar/2026-10-21', '/calendar/2026-10-24']);
});
