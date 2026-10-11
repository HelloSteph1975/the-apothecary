import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { entryTitle, harvestTaskFor, GARDEN_KINDS, GARDEN_TASKS, KIND_ICON } from '../../client/src/lib/garden.js';
import { todayString } from '../../client/src/lib/today.js';

const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return todayString(d); };
const plant = (id, over = {}) => ({
  id, name: `Plant ${id}`, herb: null, place: null, planted_on: '2026-10-01', expected_harvest_on: null, ended_on: null,
  last_entry: null, cover: null, ...over,
});
let calls;
let plants;
let failPlants;
beforeEach(() => {
  calls = [];
  plants = () => [];
  failPlants = false;
  global.fetch = vi.fn(async url => {
    calls.push(url);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url.startsWith('/api/garden/plants')) {
      if (failPlants) return json({ error: 'The garden is closed' }, 500);
      return json(plants(new URL(url, 'http://x').searchParams));
    }
    if (url.startsWith('/api/garden/suggestions')) return json({ off: false, tasks: [] });
    return json({});
  });
});
const open = (path = '/garden') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};

it('has the garden vocabulary', () => {
  expect(entryTitle('harvested', 'Calendula')).toBe('Harvested Calendula');
  expect(GARDEN_KINDS.map(k => k.label)).toEqual(['Planted', 'Sowed', 'Transplanted', 'Pruned', 'Harvested', 'Foraged', 'Observed']);
  expect(GARDEN_TASKS.map(t => t.value)).toEqual(['sow-above', 'sow-root', 'transplant', 'prune', 'weed', 'harvest-above', 'harvest-root']);
  expect(harvestTaskFor('root')).toBe('harvest-root');
  expect(harvestTaskFor('leaf')).toBe('harvest-above');
  expect(harvestTaskFor(null)).toBe('harvest-above');
  expect(Object.keys(KIND_ICON)).toEqual(GARDEN_KINDS.map(k => k.value));
});

it('shows plant cards with the header, actions and last entry', async () => {
  plants = () => [plant(1, {
    name: 'Rosie', herb: { id: 4, name: 'Rose', live: true }, place: 'Back bed',
    expected_harvest_on: addDays(30), last_entry: { id: 9, kind: 'pruned', entry_date: '2026-10-08' }, cover: 'abc.jpg',
  })];
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Garden log' })).toBeInTheDocument();
  expect(screen.getByText('What grows, what you gathered, and when')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Log something' })).toHaveAttribute('href', '/garden/entries/new');
  expect(screen.getByRole('link', { name: 'Add a plant' })).toHaveAttribute('href', '/garden/plants/new');
  expect(screen.getByRole('link', { name: 'The whole log' })).toHaveAttribute('href', '/garden/log');
  expect(await screen.findByRole('link', { name: 'Rosie' })).toHaveAttribute('href', '/garden/plants/1');
  expect(screen.getByText('Rose')).toBeInTheDocument();
  expect(screen.getByText('Back bed')).toBeInTheDocument();
  expect(screen.getByText('Planted Oct 1')).toBeInTheDocument();
  expect(screen.getByText(/^Harvest around /)).toBeInTheDocument();
  expect(screen.queryByText('Harvest due')).not.toBeInTheDocument();
  expect(screen.getByText('Pruned, Oct 8')).toBeInTheDocument();
  expect(document.querySelector('img[src="/photos/abc.jpg"]')).not.toBeNull();
  expect(calls).toContain('/api/garden/plants?status=growing');
});

it('hides the herb name when it matches the plant name', async () => {
  plants = () => [plant(1, { name: 'Calendula', herb: { id: 2, name: 'Calendula', live: true } })];
  open();
  await screen.findByRole('link', { name: 'Calendula' });
  expect(screen.getAllByText('Calendula')).toHaveLength(1);
});

it('flags harvests due within a week or past, but not later or on ended plants', async () => {
  plants = p => (p.get('status') === 'ended'
    ? [plant(5, { name: 'Done', expected_harvest_on: addDays(-3), ended_on: '2026-10-05' })]
    : [
      plant(1, { name: 'Soon', expected_harvest_on: addDays(7) }),
      plant(2, { name: 'Late', expected_harvest_on: addDays(-2) }),
      plant(3, { name: 'Far', expected_harvest_on: addDays(8) }),
    ]);
  const router = open();
  await screen.findByRole('link', { name: 'Soon' });
  expect(screen.getAllByText('Harvest due')).toHaveLength(2);
  await userEvent.click(screen.getByRole('link', { name: 'Ended' }));
  await screen.findByRole('link', { name: 'Done' });
  expect(router.state.location.search).toBe('?status=ended');
  expect(calls).toContain('/api/garden/plants?status=ended');
  expect(screen.queryByText('Harvest due')).not.toBeInTheDocument();
});

it('opens on the ended tab from the URL and shows the empty state', async () => {
  open('/garden?status=ended');
  expect(await screen.findByText('No ended plants.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ended' })).toHaveAttribute('aria-current', 'page');
});

it('invites the first plant when nothing is growing', async () => {
  open();
  expect(await screen.findByText('Nothing planted yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add the first plant.' })).toHaveAttribute('href', '/garden/plants/new');
});

it('shows an error with Try again for the plant list', async () => {
  failPlants = true;
  open();
  expect(await screen.findByText('The garden is closed')).toBeInTheDocument();
  failPlants = false;
  plants = () => [plant(1, { name: 'Rosie' })];
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Rosie' })).toBeInTheDocument();
});
