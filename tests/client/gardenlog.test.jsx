import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const plants = [
  { id: 7, name: 'Back bed calendula', herb: null, place: 'Back bed', planted_on: '2026-09-01', expected_harvest_on: null, ended_on: null, last_entry: null, cover: null },
  { id: 8, name: 'Old sage', herb: null, place: null, planted_on: '2026-03-01', expected_harvest_on: null, ended_on: '2026-09-30', last_entry: null, cover: null },
];
const entry = (n, extra = {}) => ({
  id: n, entry_date: '2026-10-05', kind: 'harvested', title: 'Harvested Calendula',
  plant: { id: 7, name: 'Back bed calendula', live: true }, plant_name: 'Calendula', place: 'Back bed', amount: 30, unit: 'g', weather: 'Sunny',
  sky: { phase: 'waxing gibbous', sign: 'Taurus' }, item: null, cover: null, ...extra,
});
let calls;
let page1;
let page2;
let total;
let listFail;
beforeEach(() => {
  calls = [];
  listFail = false;
  total = 2;
  page1 = [entry(1), entry(2, { kind: 'pruned', title: 'Pruned Sage', place: null, amount: null, unit: null, weather: null, cover: 'a.jpg' })];
  page2 = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ method: opts.method ?? 'GET', url });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/garden/plants?status=all') return json(plants);
    if (url.startsWith('/api/garden/entries')) {
      if (listFail) { listFail = false; return json({ error: 'The log would not load.' }, 500); }
      const pageNo = Number(new URL(url, 'http://x').searchParams.get('page') ?? 1);
      return json({ entries: pageNo === 1 ? page1 : page2, total, page: pageNo });
    }
    return json({});
  });
});
const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const lastList = () => calls.filter(c => c.url.startsWith('/api/garden/entries')).at(-1).url;

it('lists the whole log with date, kind, title link, place, amount, weather, sky and cover', async () => {
  open('/garden/log');
  expect(await screen.findByRole('heading', { level: 1, name: 'The whole log' })).toBeInTheDocument();
  const rows = await screen.findAllByRole('row');
  const first = within(rows[1]);
  expect(first.getByText('Oct 5')).toBeInTheDocument();
  expect(first.getByText('Harvested', { selector: 'span' })).toBeInTheDocument();
  expect(first.getByRole('link', { name: 'Harvested Calendula' })).toHaveAttribute('href', '/garden/entries/1');
  expect(first.getByText('Back bed')).toBeInTheDocument();
  expect(first.getByText('30 g')).toBeInTheDocument();
  expect(first.getByText('Sunny')).toBeInTheDocument();
  expect(first.getByText('Waxing gibbous in Taurus')).toBeInTheDocument();
  const second = within(rows[2]);
  expect(second.getByRole('link', { name: 'Pruned Sage' })).toBeInTheDocument();
  expect(rows[2].querySelector('img')).toHaveAttribute('src', '/photos/a.jpg');
  expect(lastList()).toBe('/api/garden/entries');
});

it('keeps the filters in the address and sends them to the API', async () => {
  const user = userEvent.setup();
  const router = open('/garden/log');
  await screen.findAllByRole('row');
  await user.selectOptions(screen.getByLabelText('Kind'), 'Harvested');
  await user.selectOptions(screen.getByLabelText('Plant'), 'Back bed calendula');
  await waitFor(() => expect(lastList()).toContain('kind=harvested'));
  expect(lastList()).toContain('plant_id=7');
  expect(router.state.location.search).toContain('kind=harvested');
  expect(router.state.location.search).toContain('plant_id=7');
});

it('starts from filters in the address, including From and To', async () => {
  open('/garden/log?kind=foraged&plant_id=8&from=2026-10-01&to=2026-10-31');
  await screen.findAllByRole('row');
  expect(screen.getByLabelText('Kind')).toHaveValue('foraged');
  await waitFor(() => expect(screen.getByLabelText('Plant')).toHaveValue('8'));
  expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
  expect(screen.getByLabelText('To')).toHaveValue('2026-10-31');
  const url = new URL(lastList(), 'http://x').searchParams;
  expect([url.get('kind'), url.get('plant_id'), url.get('from'), url.get('to')]).toEqual(['foraged', '8', '2026-10-01', '2026-10-31']);
});

it('pages with More entries until the log is all shown', async () => {
  const user = userEvent.setup();
  total = 3;
  page2 = [entry(3, { title: 'Harvested Mint' })];
  open('/garden/log');
  await screen.findAllByRole('row');
  await user.click(screen.getByRole('button', { name: 'More entries' }));
  expect(await screen.findByRole('link', { name: 'Harvested Mint' })).toBeInTheDocument();
  expect(lastList()).toBe('/api/garden/entries?page=2');
  expect(screen.queryByRole('button', { name: 'More entries' })).toBeNull();
});

it('says the log is empty, and links to log the first thing', async () => {
  total = 0; page1 = [];
  open('/garden/log');
  expect(await screen.findByRole('heading', { name: 'The log is empty.' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Log the first thing you did.' })).toHaveAttribute('href', '/garden/entries/new');
});

it('says no entries match when a filter finds nothing', async () => {
  total = 0; page1 = [];
  open('/garden/log?kind=pruned');
  expect(await screen.findByText('No entries match.')).toBeInTheDocument();
});

it('shows a failed load with Try again', async () => {
  const user = userEvent.setup();
  listFail = true;
  open('/garden/log');
  expect(await screen.findByRole('alert')).toHaveTextContent('The log would not load.');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findAllByRole('row')).not.toHaveLength(0);
});
