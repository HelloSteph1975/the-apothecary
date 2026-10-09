import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';

let settings;
let summary;
let items;
let failToday;
let herbOfDay;
const item = (id, name, extra = {}) => ({ id, name, size_label: null, amount: 40, unit: 'g', low_threshold: 50, expires_on: null, section_name: 'Shelf A', cover: null, ...extra });
beforeEach(() => {
  settings = { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };
  summary = { runningLow: [], nearingExpiry: [], expired: [], batchesDue: [], counts: { runningLow: 0, nearingExpiry: 0, expired: 0 } };
  items = [];
  failToday = false;
  herbOfDay = null;
  global.fetch = vi.fn(async url => {
    const json = body => new Response(JSON.stringify(body), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url.startsWith('/api/herb-of-the-day')) return json(herbOfDay);
    if (url.startsWith('/api/today')) return failToday ? new Response(JSON.stringify({ error: 'nope' }), { status: 500 }) : json(summary);
    if (url.startsWith('/api/items')) return json(items);
    return json(settings);
  });
});
const today = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);

it('greets the keeper by name when one is set', async () => {
  settings.keeper_name = 'Stephanie';
  today();
  expect(await screen.findByRole('heading', { level: 1, name: /good (morning|afternoon|evening), stephanie/i })).toBeInTheDocument();
});

it('greets without a name when none is set', async () => {
  today();
  expect(await screen.findByRole('heading', { level: 1, name: /^good (morning|afternoon|evening)$/i })).toBeInTheDocument();
});

it('shows the three cabinet cards', async () => {
  today();
  for (const name of ['Batches due', 'Running low', 'Nearing expiry']) {
    expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
  }
  expect(screen.getByText('Batches arrive in a later stage.')).toBeInTheDocument();
});

it('shows running low and nearing expiry rows that link to the herb', async () => {
  summary = {
    runningLow: [item(1, 'Calendula'), item(2, 'Chamomile', { amount: 6, unit: 'count' })],
    nearingExpiry: [item(3, 'Lavender', { expires_on: '2026-10-20' })],
    expired: [item(4, 'Mint', { expires_on: '2026-10-07' })],
    batchesDue: [],
    counts: { runningLow: 2, nearingExpiry: 1, expired: 1 },
  };
  today();
  expect(await screen.findByRole('link', { name: /Calendula, 40 g left/ })).toHaveAttribute('href', '/cabinet/items/1');
  expect(screen.getByRole('link', { name: /Chamomile, 6 left/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Mint, past its best since Oct 7/ })).toHaveAttribute('href', '/cabinet/items/4');
  expect(screen.getByRole('link', { name: /Lavender, use by Oct 20/ })).toBeInTheDocument();
  const mint = screen.getByRole('link', { name: /Mint/ });
  const lav = screen.getByRole('link', { name: /Lavender/ });
  expect(mint.compareDocumentPosition(lav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText(/See all/)).toBeNull();
});

it('offers See all when a list is capped', async () => {
  summary = { ...summary, runningLow: [item(1, 'Calendula')], nearingExpiry: [item(3, 'Lavender', { expires_on: '2026-10-20' })], counts: { runningLow: 10, nearingExpiry: 12, expired: 9 } };
  today();
  expect(await screen.findByRole('link', { name: 'See all 10' })).toHaveAttribute('href', '/cabinet?status=low');
  expect(screen.getByRole('link', { name: 'See all 12' })).toHaveAttribute('href', '/cabinet?status=expiring');
  expect(screen.getByRole('link', { name: 'See all 9' })).toHaveAttribute('href', '/cabinet?status=expired');
});

it('says nothing is low or close to its date when the cabinet has herbs', async () => {
  items = [item(1, 'Calendula')];
  today();
  expect(await screen.findByText('Nothing is running low.')).toBeInTheDocument();
  expect(screen.getByText('Nothing is close to its date.')).toBeInTheDocument();
});

it('shows the gentle note and a stock link when the cabinet is empty', async () => {
  today();
  expect(await screen.findAllByText(/once the herb cabinet is stocked/i)).toHaveLength(2);
  expect(screen.getAllByRole('link', { name: 'Stock the cabinet' })[0]).toHaveAttribute('href', '/cabinet/new');
});

it('says so and lets her try again when the cabinet cannot be read', async () => {
  failToday = true;
  items = [item(1, 'Calendula')];
  today();
  expect(await screen.findAllByText("Couldn't read the cabinet.")).not.toHaveLength(0);
  failToday = false;
  await userEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
  expect(await screen.findByText('Nothing is running low.')).toBeInTheDocument();
});

it('has a wax seal button to log a batch', async () => {
  today();
  expect(await screen.findByRole('button', { name: /log a batch/i })).toBeInTheDocument();
});

it('moves from morning to afternoon without a reload', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 11, 58, 0));
  try {
    today();
    expect(await screen.findByRole('heading', { level: 1, name: 'Good morning' })).toBeInTheDocument();
    await act(async () => { vi.setSystemTime(new Date(2026, 9, 8, 12, 1, 0)); await vi.advanceTimersByTimeAsync(61000); });
    expect(screen.getByRole('heading', { level: 1, name: 'Good afternoon' })).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('shows the herb of the day, linking to its page', async () => {
  herbOfDay = { id: 3, common_name: 'Lavender', latin_name: 'Lavandula angustifolia', uses: 'Calms the evening. Scents linens.', planet: 'Mercury', element: 'Air', cover: null };
  today();
  expect(await screen.findByRole('heading', { level: 2, name: 'Herb of the day' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Lavender' })).toHaveAttribute('href', '/grimoire/3');
  expect(screen.getByText('Lavandula angustifolia')).toBeInTheDocument();
  expect(screen.getByText('Calms the evening.')).toBeInTheDocument();
  expect(screen.queryByText(/Scents linens/)).not.toBeInTheDocument();
  expect(screen.getByText(/Mercury/)).toHaveTextContent('Mercury, Air');
  expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/herb-of-the-day\?today=\d{4}-\d{2}-\d{2}$/), expect.anything());
});

it('hides the herb of the day card when there is none', async () => {
  today();
  await screen.findByRole('heading', { level: 2, name: 'Running low' });
  expect(screen.queryByRole('heading', { name: 'Herb of the day' })).not.toBeInTheDocument();
});
