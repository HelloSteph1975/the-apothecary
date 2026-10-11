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
  id: 4, title: 'Samhain night', type_id: 1, entry_date: '2026-10-31', entry_time: '21:30', mood: 'calm',
  body: 'Lit the candles.\nSat with the quiet.', sky_phase: 'waxing gibbous', sky_sign: 'Taurus', sky_ruler: 'Saturn', sky_festival: 'Samhain',
  type: { id: 1, name: 'Ritual', icon: 'sparkles' },
  sky: { phase: 'waxing gibbous', sign: 'Taurus', ruler: 'Saturn', festival: 'Samhain' },
  links: [
    { type: 'herb', id: 3, name: 'Mugwort', live: true },
    { type: 'recipe', id: 5, name: 'Dream oil', live: true },
    { type: 'batch', id: 8, name: 'Old batch', live: false },
  ],
  tags: ['samhain', 'ancestors'], photos: [],
};
let entry;
let calls;
let location;
beforeEach(() => {
  calls = [];
  entry = base;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/journal/4' && method === 'DELETE') return json({ ok: true, restore: '/api/journal/4/restore' });
    if (url === '/api/journal/4/restore') return json(entry);
    if (url.startsWith('/api/journal?')) return json({ view: 'list', entries: [], total: 0, page: 1 });
    if (url === '/api/journal/4') return entry ? json(entry) : json({ error: 'That entry is not in the journal.' }, 404);
    return json({});
  });
});
const open = (path = '/journal/4') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  location = () => router.state.location;
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};

it('shows the title, type, date and time, the sky, the body, the mood and the tags', async () => {
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Samhain night' })).toBeInTheDocument();
  expect(screen.getByText(/Ritual/)).toHaveTextContent(/Oct 31.*9:30 PM/);
  const sky = screen.getByRole('region', { name: 'The sky that day' });
  expect(sky).toHaveTextContent('Waxing gibbous in Taurus, Saturday under Saturn, Samhain');
  expect(screen.getByText(/Lit the candles\./).textContent).toBe('Lit the candles.\nSat with the quiet.');
  expect(screen.getByText(/Lit the candles\./)).toHaveStyle({ whiteSpace: 'pre-wrap' });
  expect(screen.getByText('Calm')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'samhain' })).toHaveAttribute('href', '/journal?view=tag&tag=samhain');
  expect(screen.getByRole('link', { name: 'ancestors' })).toHaveAttribute('href', '/journal?view=tag&tag=ancestors');
});

it('lists linked records with links and mutes the ones that are gone', async () => {
  open();
  const card = await screen.findByRole('region', { name: 'Linked' });
  expect(within(card).getByRole('link', { name: 'Mugwort' })).toHaveAttribute('href', '/grimoire/3');
  expect(within(card).getByRole('link', { name: 'Dream oil' })).toHaveAttribute('href', '/recipes/5');
  expect(within(card).queryByRole('link', { name: 'Old batch' })).toBeNull();
  expect(within(card).getByText('Old batch')).toBeInTheDocument();
  expect(within(card).getByText('(no longer here)')).toBeInTheDocument();
});

it('leaves out the optional parts when they are empty', async () => {
  entry = { ...base, mood: null, links: [], tags: [], entry_time: null, sky: { phase: null, sign: null, ruler: null, festival: null } };
  open();
  await screen.findByRole('heading', { level: 1, name: 'Samhain night' });
  expect(screen.queryByRole('region', { name: 'Linked' })).toBeNull();
  expect(screen.queryByText('Calm')).toBeNull();
  expect(screen.queryByRole('region', { name: 'The sky that day' })).toBeNull();
});

it('has a photo gallery for the entry', async () => {
  open();
  await screen.findByRole('heading', { level: 1, name: 'Samhain night' });
  expect(screen.getByRole('region', { name: 'Photos' })).toBeInTheDocument();
});

it('links Edit to the edit form', async () => {
  open();
  expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/journal/4/edit');
});

it('deletes with undo that returns to the entry, then goes to the journal', async () => {
  const user = userEvent.setup();
  const router = open();
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', url: '/api/journal/4' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal'));
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls).toContainEqual({ method: 'POST', url: '/api/journal/4/restore' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal/4'));
});

it('says when the entry is gone and offers Try again on other errors', async () => {
  entry = null;
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('That entry is not in the journal.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('links a garden entry to its page in the log', async () => {
  entry = { ...base, links: [{ type: 'garden_entry', id: 12, name: 'Harvested Calendula', live: true }] };
  open();
  expect(await screen.findByRole('link', { name: 'Harvested Calendula' })).toHaveAttribute('href', '/garden/entries/12');
  expect(screen.getByText('Garden entry:')).toBeInTheDocument();
});
