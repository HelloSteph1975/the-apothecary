import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const base = {
  id: 5, entry_date: '2026-10-05', kind: 'harvested', title: 'Harvested Calendula',
  plant: { id: 7, name: 'Back bed calendula', live: true }, plant_id: 7, plant_name: 'Calendula', herb_id: 3,
  place: 'Back bed', amount: 30, unit: 'g', weather: 'Sunny, 18 C', notes: 'A good first flush.', item_id: null,
  sky: { phase: 'waxing gibbous', sign: 'Taurus' }, item: null, cover: null, photos: [],
};
let entry;
let calls;
let router;
beforeEach(() => {
  calls = [];
  entry = base;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/garden/entries/5' && method === 'DELETE') return json({ ok: true, restore: '/api/garden/entries/5/restore' });
    if (url === '/api/garden/entries/5/restore') return json(entry);
    if (url === '/api/garden/entries/5') return entry ? json(entry) : json({ error: 'That entry is not in the log.' }, 404);
    if (url === '/api/garden/plants?status=all') return json([]);
    if (url.startsWith('/api/garden/entries')) return json({ entries: [], total: 0, page: 1 });
    return json({});
  });
});
const open = (path = '/garden/entries/5') => {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
};

it('shows the title, date and the plant, place, amount, weather and moon lines', async () => {
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Harvested Calendula' })).toBeInTheDocument();
  expect(screen.getByText('Oct 5, 2026')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back bed calendula' })).toHaveAttribute('href', '/garden/plants/7');
  expect(screen.getByText('Back bed')).toBeInTheDocument();
  expect(screen.getByText('30 g')).toBeInTheDocument();
  expect(screen.getByText('Sunny, 18 C')).toBeInTheDocument();
  expect(screen.getByText('The moon that day: waxing gibbous in Taurus')).toBeInTheDocument();
  expect(screen.getByText('A good first flush.')).toBeInTheDocument();
  expect(screen.queryByText(/identify with complete certainty/)).toBeNull();
});

it('mutes a plant that is no longer here', async () => {
  entry = { ...base, plant: { id: 7, name: 'Back bed calendula', live: false } };
  open();
  await screen.findByRole('heading', { level: 1 });
  expect(screen.queryByRole('link', { name: 'Back bed calendula' })).toBeNull();
  expect(screen.getByText('(no longer here)')).toBeInTheDocument();
});

it('shows the plain name when it was not a plant of hers', async () => {
  entry = { ...base, plant: null, plant_id: null };
  open();
  await screen.findByRole('heading', { level: 1 });
  expect(screen.getByText('Calendula')).toBeInTheDocument();
  expect(screen.queryByText('(no longer here)')).toBeNull();
});

it('shows the foraging note on foraged entries', async () => {
  entry = { ...base, kind: 'foraged', title: 'Foraged Calendula' };
  open();
  expect(await screen.findByText(/Only gather a plant you can identify with complete certainty, and only where foraging is allowed\./)).toBeInTheDocument();
});

it('offers Send to the cabinet on a harvest with no jar', async () => {
  open();
  const link = await screen.findByRole('link', { name: 'Send to the cabinet' });
  expect(link).toHaveAttribute('href', '/cabinet/new?garden_entry=5');
});

it('links the jar when a live one holds the harvest', async () => {
  entry = { ...base, item_id: 12, item: { id: 12, name: 'Calendula jar', live: true } };
  open();
  expect(await screen.findByRole('link', { name: 'Calendula jar' })).toHaveAttribute('href', '/cabinet/items/12');
  expect(screen.getByText(/Jar:/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Send to the cabinet' })).toBeNull();
});

it('offers the cabinet again when the jar was deleted', async () => {
  entry = { ...base, item_id: 12, item: { id: 12, name: 'Calendula jar', live: false } };
  open();
  expect(await screen.findByRole('link', { name: 'Send to the cabinet' })).toBeInTheDocument();
});

it('has no cabinet button on other kinds', async () => {
  entry = { ...base, kind: 'pruned', title: 'Pruned Calendula' };
  open();
  await screen.findByRole('heading', { level: 1 });
  expect(screen.queryByRole('link', { name: 'Send to the cabinet' })).toBeNull();
});

it('deletes with undo and goes back to the log', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', url: '/api/garden/entries/5' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/log'));
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', url: '/api/garden/entries/5/restore' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/entries/5'));
});

it('links Edit', async () => {
  open();
  expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/garden/entries/5/edit');
});

it('shows a missing entry with Try again and a way back', async () => {
  entry = null;
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('That entry is not in the log.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to the log' })).toHaveAttribute('href', '/garden/log');
});
