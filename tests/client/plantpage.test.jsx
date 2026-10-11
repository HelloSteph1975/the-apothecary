import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { todayString } from '../../client/src/lib/today.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const day = (iso, score = 3) => ({ day: iso, score, sky: { phase: 'full', sign: 'Leo', ruler: 'Sun' }, reasons: ['A full moon in a fire sign.'] });
const base = {
  id: 7, name: 'Back bed calendula', herb_id: 3, place: 'Back bed', planted_on: '2026-10-01', expected_harvest_on: '2026-12-01', ended_on: null,
  notes: 'Started from seed.', deleted_at: null,
  herb: { id: 3, name: 'Calendula', live: true },
  garden_notes: {
    garden_harvest_part: 'flower', garden_harvest_timing: 'Pick open blooms in the morning', garden_sun: 'Full sun', garden_water: 'Moderate',
    garden_companions: ['Tomato', 'Basil'],
  },
  last_entry: { id: 11, kind: 'harvested', entry_date: '2026-10-05' },
  entries: [
    { id: 11, entry_date: '2026-10-05', kind: 'harvested', title: 'Harvested Back bed calendula', plant: { id: 7, name: 'Back bed calendula', live: true }, amount: 30, unit: 'g' },
    { id: 10, entry_date: '2026-10-01', kind: 'planted', title: 'Planted Back bed calendula', plant: { id: 7, name: 'Back bed calendula', live: true }, amount: null, unit: null },
  ],
  photos: [],
};
let plant;
let suggestions;
let calls;
beforeEach(() => {
  calls = [];
  plant = base;
  suggestions = {
    off: false,
    tasks: [
      { task: 'harvest-above', days: [day('2026-10-17'), day('2026-10-18', 2)] },
      { task: 'harvest-root', days: [day('2026-10-25')] },
    ],
  };
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/garden/plants/7' && method === 'DELETE') return json({ ok: true, restore: '/api/garden/plants/7/restore' });
    if (url === '/api/garden/plants/7/restore') return json({ ok: true });
    if (url === '/api/garden/plants/7' && method === 'PATCH') return json({ id: 7 });
    if (url === '/api/garden/plants/7') return json(plant);
    if (url === '/api/garden/suggestions') return json(suggestions);
    if (url.startsWith('/api/garden/plants?')) return json([]);
    return json({});
  });
});
const open = (path = '/garden/plants/7') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};

it('shows the name, the place and planting day, and a link to the herb', async () => {
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Back bed calendula' })).toBeInTheDocument();
  expect(screen.getByText('Back bed, Planted Oct 1')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Calendula' })).toHaveAttribute('href', '/grimoire/3');
  expect(screen.getByText('Started from seed.')).toBeInTheDocument();
});

it('shows the herb notes in the garden card', async () => {
  open();
  const card = await screen.findByRole('region', { name: 'In the garden' });
  expect(within(card).getByText('Part harvested').nextElementSibling).toHaveTextContent('flower');
  expect(within(card).getByText('Harvest timing').nextElementSibling).toHaveTextContent('Pick open blooms in the morning');
  expect(within(card).getByText('Sun').nextElementSibling).toHaveTextContent('Full sun');
  expect(within(card).getByText('Water').nextElementSibling).toHaveTextContent('Moderate');
  expect(within(card).getByText('Grows well with').nextElementSibling).toHaveTextContent('Tomato, Basil');
});

it('says so when there is no herb behind the plant', async () => {
  plant = { ...base, herb_id: null, herb: null, garden_notes: null };
  open();
  const card = await screen.findByRole('region', { name: 'In the garden' });
  expect(within(card).getByText('No grimoire notes for this plant.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Calendula' })).toBeNull();
});

it('does not link to a herb that was deleted', async () => {
  plant = { ...base, herb: { id: 3, name: 'Calendula', live: false }, garden_notes: null };
  open();
  await screen.findByRole('heading', { level: 1, name: 'Back bed calendula' });
  expect(screen.queryByRole('link', { name: 'Calendula' })).toBeNull();
});

it('lists good harvest days for a flower, labelled as folk tradition', async () => {
  open();
  const card = await screen.findByRole('region', { name: 'Good days to harvest' });
  expect(within(card).getByText(/Folk tradition/)).toBeInTheDocument();
  const links = within(card).getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href', '/calendar/2026-10-17');
  expect(links[0]).toHaveTextContent('Sat Oct 17');
  expect(links[0]).toHaveTextContent('full moon in Leo');
});

it('shows the harvest days in date order', async () => {
  suggestions.tasks[0].days = [day('2026-10-24'), day('2026-10-17', 2), day('2026-10-20')];
  open();
  const card = await screen.findByRole('region', { name: 'Good days to harvest' });
  expect(within(card).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/calendar/2026-10-17', '/calendar/2026-10-20', '/calendar/2026-10-24']);
});

it('uses the root days for a root crop', async () => {
  plant = { ...base, garden_notes: { ...base.garden_notes, garden_harvest_part: 'root' } };
  open();
  const card = await screen.findByRole('region', { name: 'Good days to harvest' });
  const links = within(card).getAllByRole('link');
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute('href', '/calendar/2026-10-25');
});

it('uses the root days when the herb part is written out, like "Roots and rhizome"', async () => {
  plant = { ...base, garden_notes: { ...base.garden_notes, garden_harvest_part: 'Roots and rhizome' } };
  open();
  const card = await screen.findByRole('region', { name: 'Good days to harvest' });
  expect(within(card).getByRole('link')).toHaveAttribute('href', '/calendar/2026-10-25');
});

it('hides the harvest days when suggestions are off', async () => {
  suggestions = { off: true, tasks: [] };
  open();
  await screen.findByRole('region', { name: 'In the garden' });
  await waitFor(() => expect(calls.some(c => c.url === '/api/garden/suggestions')).toBe(true));
  expect(screen.queryByRole('region', { name: 'Good days to harvest' })).toBeNull();
});

it('shows the log with a kind, an amount and a link, and a way to log more', async () => {
  open();
  const log = await screen.findByRole('region', { name: 'Garden log' });
  const items = within(log).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('Oct 5');
  expect(items[0]).toHaveTextContent('30 g');
  expect(within(items[0]).getByRole('link', { name: 'Harvested' })).toHaveAttribute('href', '/garden/entries/11');
  expect(within(items[1]).getByRole('link', { name: 'Planted' })).toHaveAttribute('href', '/garden/entries/10');
  expect(within(log).getByRole('link', { name: 'Log something' })).toHaveAttribute('href', '/garden/entries/new?plant=7');
});

it('says so when nothing is logged', async () => {
  plant = { ...base, entries: [], last_entry: null };
  open();
  expect(await screen.findByText('Nothing logged for this plant yet.')).toBeInTheDocument();
});

it('shows the plant photos in a gallery', async () => {
  plant = { ...base, photos: [{ id: 21, filename: 'calendula.jpg', caption: 'First flowers', is_cover: 1 }] };
  open();
  const card = await screen.findByRole('region', { name: 'Photos' });
  expect(within(card).getByLabelText('Caption for photo 1')).toHaveValue('First flowers');
  expect(within(card).getByRole('img')).toHaveAttribute('src', expect.stringContaining('calendula.jpg'));
});

it('marks the plant as ended on the chosen day', async () => {
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as ended' }));
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByLabelText('Ended on');
  expect(input).toHaveValue(todayString());
  await userEvent.clear(input);
  await userEvent.type(input, '2026-11-02');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as ended' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ ended_on: '2026-11-02' }));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

it('shows a server error inside the ended dialog', async () => {
  const real = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (url === '/api/garden/plants/7' && opts.method === 'PATCH') {
      return new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { ended_on: 'This must not be before the planting date.' } }), { status: 400 });
    }
    return real(url, opts);
  });
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as ended' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as ended' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('This must not be before the planting date.');
});

it('shows an ended plant with Growing again, which clears the end day', async () => {
  plant = { ...base, ended_on: '2026-11-02' };
  open();
  expect(await screen.findByText('Ended Nov 2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark as ended' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Good days to harvest' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Growing again' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ ended_on: null }));
});

it('deletes with undo and goes back to the garden', async () => {
  const router = open();
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden'));
  expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/garden/plants/7')).toBe(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/plants/7'));
  expect(calls.some(c => c.url === '/api/garden/plants/7/restore')).toBe(true);
});

it('shows an error with Try again when the plant is gone', async () => {
  global.fetch = vi.fn(async url => (url === '/api/garden/plants/7'
    ? new Response(JSON.stringify({ error: 'That plant is not in the garden log.' }), { status: 404 }) : new Response(JSON.stringify({ off: true, tasks: [] }))));
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('That plant is not in the garden log.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
