import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { todayString } from '../../client/src/lib/today.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const herbs = [{ id: 3, common_name: 'Calendula' }, { id: 4, common_name: 'Mint' }];
const growing = [
  { id: 7, name: 'Back bed calendula', herb: { id: 3, name: 'Calendula', live: true }, place: 'Back bed', planted_on: '2026-09-01', expected_harvest_on: null, ended_on: null, last_entry: null, cover: null },
  { id: 8, name: 'Mint pot', herb: null, place: 'Window box', planted_on: '2026-09-01', expected_harvest_on: null, ended_on: null, last_entry: null, cover: null },
];
const existing = {
  id: 5, entry_date: '2026-10-05', kind: 'harvested', title: 'Harvested Calendula',
  plant: { id: 7, name: 'Back bed calendula', live: true }, plant_id: 7, plant_name: 'Calendula', herb_id: 3,
  place: 'Back bed', amount: 30, unit: 'g', weather: 'Sunny', notes: 'First flush.', item_id: null,
  sky: { phase: 'waxing gibbous', sign: 'Taurus' }, item: null, cover: null, photos: [],
};
let calls;
let router;
let fail;
let slow;
let detail;
beforeEach(() => {
  calls = [];
  fail = null;
  slow = null;
  detail = existing;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/herbs') return json(herbs);
    if (url === '/api/garden/plants?status=growing') return json(growing);
    if (method === 'POST' && url === '/api/garden/entries') {
      if (slow) await slow;
      if (fail) return json(fail.body, fail.status);
      return json({ ...existing, id: 9 }, 201);
    }
    if (method === 'PATCH' && url === '/api/garden/entries/5') {
      if (fail) return json(fail.body, fail.status);
      return json(existing);
    }
    if (url === '/api/garden/entries/9') return json({ ...existing, id: 9 });
    if (url === '/api/garden/entries/5') return json(detail);
    return json({});
  });
});
const open = async path => {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  await screen.findByLabelText('What you did (required)');
  await waitFor(() => expect(screen.getByLabelText('Plant').querySelectorAll('option').length).toBeGreaterThan(1));
};
const saved = () => calls.filter(c => c.method === 'POST' || c.method === 'PATCH');

it('starts on today with the kind required and the growing plants plus Something else', async () => {
  await open('/garden/entries/new');
  expect(screen.getByRole('heading', { level: 1, name: 'Log something' })).toBeInTheDocument();
  expect(screen.getByLabelText('Date')).toHaveValue(todayString());
  expect(screen.getByLabelText('What you did (required)')).toHaveValue('');
  const options = [...screen.getByLabelText('Plant').querySelectorAll('option')].map(o => o.textContent);
  expect(options).toEqual(['Something else', 'Back bed calendula', 'Mint pot']);
  expect(screen.getByLabelText('Name (required)')).toBeInTheDocument();
  expect(screen.getByLabelText('Grimoire herb')).toBeInTheDocument();
});

it('prefills the plant, date and kind from the address and hides the name for a plant', async () => {
  await open('/garden/entries/new?plant=8&date=2026-10-02&kind=pruned');
  expect(screen.getByLabelText('Plant')).toHaveValue('8');
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-02');
  expect(screen.getByLabelText('What you did (required)')).toHaveValue('pruned');
  expect(screen.queryByLabelText('Name (required)')).toBeNull();
});

it('saves a plant entry with plant_id and an empty place so the plant place applies', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/new?plant=7');
  await user.selectOptions(screen.getByLabelText('What you did (required)'), 'Harvested');
  await user.type(screen.getByLabelText('Amount'), '12');
  await user.selectOptions(screen.getByLabelText('Unit'), 'g');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body).toMatchObject({ kind: 'harvested', plant_id: 7, place: '', amount: 12, unit: 'g', entry_date: todayString() });
  expect(saved()[0].body).not.toHaveProperty('plant_name');
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/entries/9'));
});

it('saves Something else with a name and an optional herb', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/new');
  await user.selectOptions(screen.getByLabelText('What you did (required)'), 'Observed');
  await user.type(screen.getByLabelText('Name (required)'), 'Wild fennel');
  await user.selectOptions(screen.getByLabelText('Grimoire herb'), 'Mint');
  await user.type(screen.getByLabelText('Place'), 'Roadside');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body).toMatchObject({ kind: 'observed', plant_id: null, plant_name: 'Wild fennel', herb_id: 4, place: 'Roadside' });
});

it('clears an old place when the plant changes unless she typed one', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/5/edit');
  expect(screen.getByLabelText('Place')).toHaveValue('Back bed');
  await user.selectOptions(screen.getByLabelText('Plant'), 'Mint pot');
  expect(screen.getByLabelText('Place')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body).toMatchObject({ plant_id: 8, place: '' });
});

it('keeps a typed place when the plant changes', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/new');
  await user.type(screen.getByLabelText('Place'), 'Porch');
  await user.selectOptions(screen.getByLabelText('Plant'), 'Mint pot');
  expect(screen.getByLabelText('Place')).toHaveValue('Porch');
});

it('shows the foraging note when Foraged is picked', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/new');
  expect(screen.queryByText(/identify with complete certainty/)).toBeNull();
  await user.selectOptions(screen.getByLabelText('What you did (required)'), 'Foraged');
  expect(screen.getByText(/Only gather a plant you can identify with complete certainty, and only where foraging is allowed\./)).toBeInTheDocument();
});

it('fills the form from an entry being edited and saves only changes to a linked plant by id', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/5/edit');
  expect(screen.getByRole('heading', { level: 1, name: 'Edit Harvested Calendula' })).toBeInTheDocument();
  expect(screen.getByLabelText('Plant')).toHaveValue('7');
  expect(screen.getByLabelText('Amount')).toHaveValue(30);
  expect(screen.getByLabelText('Unit')).toHaveValue('g');
  expect(screen.getByLabelText('Weather')).toHaveValue('Sunny');
  expect(screen.getByLabelText('Notes')).toHaveValue('First flush.');
  await user.clear(screen.getByLabelText('Weather'));
  await user.type(screen.getByLabelText('Weather'), 'Cloudy');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0]).toMatchObject({ method: 'PATCH', url: '/api/garden/entries/5' });
  expect(saved()[0].body).toMatchObject({ plant_id: 7, weather: 'Cloudy', place: 'Back bed' });
  expect(saved()[0].body).not.toHaveProperty('plant_name');
});

it('keeps an ended plant selectable when editing its entry', async () => {
  detail = { ...existing, plant: { id: 99, name: 'Old sage', live: true }, plant_id: 99 };
  await open('/garden/entries/5/edit');
  expect(screen.getByLabelText('Plant')).toHaveValue('99');
  expect(screen.getByRole('option', { name: 'Old sage' })).toBeInTheDocument();
});

it('treats a deleted plant as Something else and keeps its name', async () => {
  detail = { ...existing, plant: { id: 7, name: 'Back bed calendula', live: false } };
  await open('/garden/entries/5/edit');
  expect(screen.getByLabelText('Plant')).toHaveValue('none');
  expect(screen.getByLabelText('Name (required)')).toHaveValue('Calendula');
});

it('shows server errors under the fields, including plant_name and plant_id', async () => {
  const user = userEvent.setup();
  fail = { status: 400, body: { error: 'Please fix the highlighted fields.', details: { plant_name: 'Required', plant_id: "That plant doesn't exist" } } };
  await open('/garden/entries/new');
  await user.selectOptions(screen.getByLabelText('What you did (required)'), 'Observed');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Required')).toBeInTheDocument();
  expect(screen.getByText("That plant doesn't exist")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/garden/entries/new');
});

it('sends only one save when Save is pressed twice', async () => {
  const user = userEvent.setup();
  let release;
  slow = new Promise(r => { release = r; });
  await open('/garden/entries/new?plant=7&kind=pruned');
  const save = screen.getByRole('button', { name: 'Save' });
  await user.click(save);
  await user.click(save);
  release();
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/entries/9'));
  expect(saved()).toHaveLength(1);
});

it('does not ask about leaving after a save', async () => {
  const user = userEvent.setup();
  await open('/garden/entries/new?plant=7&kind=pruned');
  await user.type(screen.getByLabelText('Notes'), 'Cut back hard.');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/garden/entries/9'));
  expect(screen.queryByRole('dialog')).toBeNull();
});
