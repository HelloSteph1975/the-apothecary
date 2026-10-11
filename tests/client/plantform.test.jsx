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

const herbs = [{ id: 3, common_name: 'Calendula' }, { id: 4, common_name: 'Mint' }];
const listed = [
  { id: 1, name: 'Mint pot', herb: null, place: 'Window box', planted_on: '2026-09-01', expected_harvest_on: null, ended_on: null, last_entry: null, cover: null },
  { id: 2, name: 'Sage', herb: null, place: 'Back bed', planted_on: '2026-09-01', expected_harvest_on: null, ended_on: null, last_entry: null, cover: null },
  { id: 5, name: 'Thyme', herb: null, place: 'Back bed', planted_on: '2026-09-01', expected_harvest_on: null, ended_on: '2026-10-01', last_entry: null, cover: null },
];
const plant = {
  id: 7, name: 'Back bed calendula', herb_id: 3, place: 'Back bed', planted_on: '2026-10-01', expected_harvest_on: '2026-12-01', ended_on: null,
  notes: 'Started from seed.', herb: { id: 3, name: 'Calendula', live: true }, garden_notes: null, entries: [], photos: [], last_entry: null,
};
let calls;
let saveResponse;
beforeEach(() => {
  calls = [];
  saveResponse = () => new Response(JSON.stringify({ id: 9 }), { status: 201 });
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/herbs') return json(herbs);
    if (url === '/api/garden/plants?status=all') return json(listed);
    if (url === '/api/garden/plants' && method === 'POST') return saveResponse();
    if (url === '/api/garden/plants/7' && method === 'PATCH') return json({ id: 7 });
    if (url === '/api/garden/plants/7') return json(plant);
    if (url === '/api/garden/plants/9') return json({ ...plant, id: 9 });
    if (url === '/api/garden/suggestions') return json({ off: true, tasks: [] });
    return json({});
  });
});
const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const posted = () => calls.find(c => c.method === 'POST' && c.url === '/api/garden/plants');

it('starts a new plant planted today with the places already used in a datalist', async () => {
  const { container } = { container: document };
  open('/garden/plants/new');
  expect(await screen.findByLabelText('Planted')).toHaveValue(todayString());
  const options = [...container.querySelectorAll('datalist option')].map(o => o.value);
  expect(options).toEqual(['Back bed', 'Window box']);
  expect(screen.getByLabelText('Place')).toHaveAttribute('list');
  expect(screen.queryByLabelText('Ended')).toBeNull();
});

it('fills an empty name from the herb that is picked, and leaves a typed name alone', async () => {
  open('/garden/plants/new');
  const name = await screen.findByLabelText('Name (required)');
  await userEvent.selectOptions(screen.getByLabelText('Herb'), 'Calendula');
  expect(name).toHaveValue('Calendula');
  await userEvent.clear(name);
  await userEvent.type(name, 'Front pot');
  await userEvent.selectOptions(screen.getByLabelText('Herb'), 'Mint');
  expect(name).toHaveValue('Front pot');
});

it('starts with the herb from the address', async () => {
  open('/garden/plants/new?herb=4');
  expect(await screen.findByLabelText('Herb')).toHaveValue('4');
  expect(screen.getByLabelText('Name (required)')).toHaveValue('Mint');
});

it('shows a required name error from the server and keeps the page', async () => {
  saveResponse = () => new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { name: 'Required' } }), { status: 400 });
  const router = open('/garden/plants/new');
  await screen.findByLabelText('Name (required)');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Required')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/garden/plants/new');
  expect(screen.getByLabelText('Name (required)')).toHaveAttribute('aria-invalid', 'true');
});

it('shows date errors beside the date fields', async () => {
  saveResponse = () => new Response(JSON.stringify({
    error: 'Please fix the highlighted fields.', details: { expected_harvest_on: 'This must not be before the planting date.' },
  }), { status: 400 });
  open('/garden/plants/new');
  await userEvent.type(await screen.findByLabelText('Name (required)'), 'Sage');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const field = screen.getByLabelText('Expected harvest');
  await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
  expect(screen.getByText('This must not be before the planting date.')).toBeInTheDocument();
});

it('saves, shows Saved and goes to the plant page without a leave prompt', async () => {
  const router = open('/garden/plants/new');
  await userEvent.selectOptions(await screen.findByLabelText('Herb'), 'Calendula');
  await userEvent.type(screen.getByLabelText('Place'), 'Back bed');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/plants/9'));
  expect(posted().body).toEqual({
    herb_id: 3, name: 'Calendula', place: 'Back bed', planted_on: todayString(), expected_harvest_on: null, notes: null,
  });
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 1, name: 'Back bed calendula' })).toBeInTheDocument();
  expect(screen.queryByText('Leave without saving?')).toBeNull();
});

it('ignores a second click while the save is running', async () => {
  let release;
  saveResponse = () => new Promise(resolve => { release = () => resolve(new Response(JSON.stringify({ id: 9 }), { status: 201 })); });
  open('/garden/plants/new');
  await userEvent.type(await screen.findByLabelText('Name (required)'), 'Sage');
  const save = screen.getByRole('button', { name: 'Save' });
  await userEvent.click(save);
  await userEvent.click(save);
  await waitFor(() => expect(release).toBeTypeOf('function'));
  release();
  await waitFor(() => expect(calls.filter(c => c.method === 'POST')).toHaveLength(1));
});

it('edits an existing plant with the end day and sends only what the form holds', async () => {
  const router = open('/garden/plants/7/edit');
  expect(await screen.findByLabelText('Name (required)')).toHaveValue('Back bed calendula');
  expect(screen.getByLabelText('Herb')).toHaveValue('3');
  expect(screen.getByLabelText('Planted')).toHaveValue('2026-10-01');
  const ended = screen.getByLabelText('Ended');
  await userEvent.type(ended, '2026-11-02');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/plants/7'));
  const patch = calls.find(c => c.method === 'PATCH');
  expect(patch.body).toEqual({
    herb_id: 3, name: 'Back bed calendula', place: 'Back bed', planted_on: '2026-10-01', expected_harvest_on: '2026-12-01',
    notes: 'Started from seed.', ended_on: '2026-11-02',
  });
});

it('asks before leaving a changed form', async () => {
  const router = open('/garden/plants/7/edit');
  await userEvent.type(await screen.findByLabelText('Place'), ' two');
  await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/garden/plants/7/edit');
});

it('keeps the link to a herb that was deleted when the plant is saved', async () => {
  const real = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) => (url === '/api/garden/plants/7' && (opts.method ?? 'GET') === 'GET'
    ? new Response(JSON.stringify({ ...plant, herb_id: 99, herb: { id: 99, name: 'Old herb', live: false } }))
    : real(url, opts)));
  open('/garden/plants/7/edit');
  const herb = await screen.findByLabelText('Herb');
  expect(herb).toHaveValue('99');
  expect(within(herb).getByRole('option', { name: 'Old herb (no longer in the grimoire)' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Place'), ' two');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PATCH')?.body.herb_id).toBe(99));
});
