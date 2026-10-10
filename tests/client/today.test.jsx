import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';

let settings;
let summary;
let items;
let failToday;
let herbOfDay;
let failHerb;
let posts;
const item = (id, name, extra = {}) => ({ id, name, size_label: null, amount: 40, unit: 'g', low_threshold: 50, expires_on: null, section_name: 'Shelf A', cover: null, ...extra });
beforeEach(() => {
  settings = { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };
  summary = { runningLow: [], nearingExpiry: [], expired: [], batchesDue: [], counts: { runningLow: 0, nearingExpiry: 0, expired: 0 } };
  items = [];
  failToday = false;
  herbOfDay = null;
  failHerb = false;
  posts = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (opts.method === 'POST') posts.push(url);
    const json = body => new Response(JSON.stringify(body), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url.startsWith('/api/herb-of-the-day')) return failHerb ? new Response(JSON.stringify({ error: 'nope' }), { status: 500 }) : json(herbOfDay);
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
  expect(screen.queryByText('Batches arrive in a later stage.')).toBeNull();
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

it('has a wax seal button that starts a new batch', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);
  await userEvent.click(await screen.findByRole('button', { name: /log a batch/i }));
  expect(router.state.location.pathname).toBe('/batches/new');
});

it('lists the steps due in Batches due, linking each batch, with an Overdue badge', async () => {
  summary = {
    ...summary,
    batchesDue: [
      { step_id: 1, title: 'Strain and bottle', due_on: '2026-10-07', batch_id: 5, batch_name: 'Calendula oil, Sep 20', overdue: true },
      { step_id: 2, title: 'Shake the jar', due_on: '2026-10-11', batch_id: 6, batch_name: 'Elderberry syrup', overdue: false },
    ],
    counts: { ...summary.counts, batchesDue: 2 },
  };
  today();
  const card = await screen.findByRole('region', { name: 'Batches due' });
  const first = await within(card).findByRole('link', { name: 'Calendula oil, Sep 20' });
  expect(first).toHaveAttribute('href', '/batches/5');
  expect(within(card).getByRole('link', { name: 'Elderberry syrup' })).toHaveAttribute('href', '/batches/6');
  const rows = within(card).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('Strain and bottle');
  expect(rows[0]).toHaveTextContent('Oct 7');
  expect(within(rows[0]).getByText('Overdue')).toBeInTheDocument();
  expect(within(rows[1]).queryByText('Overdue')).toBeNull();
  expect(within(card).getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/batches');
});

it('says nothing is due when no steps are close', async () => {
  today();
  const card = await screen.findByRole('region', { name: 'Batches due' });
  expect(await within(card).findByText('Nothing due in the next few days.')).toBeInTheDocument();
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
  const cautions = screen.getByRole('link', { name: 'Read its cautions before you use it.' });
  expect(cautions).toHaveAttribute('href', '/grimoire/3');
  expect(cautions.closest('p')).toHaveClass('muted');
  expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/herb-of-the-day\?today=\d{4}-\d{2}-\d{2}$/), expect.anything());
});

it('hides the herb of the day card when there is none', async () => {
  today();
  await screen.findByRole('heading', { level: 2, name: 'Running low' });
  expect(screen.queryByRole('heading', { name: 'Herb of the day' })).not.toBeInTheDocument();
});

it('shows an error line on the herb card when it fails, and retries only that request', async () => {
  const user = userEvent.setup();
  failHerb = true;
  today();
  expect(await screen.findByText("The herb of the day couldn't load.")).toBeInTheDocument();
  const before = global.fetch.mock.calls.filter(c => String(c[0]).startsWith('/api/today')).length;
  failHerb = false;
  herbOfDay = { id: 3, common_name: 'Lavender', latin_name: null, uses: null, planet: null, element: null };
  const card = screen.getByRole('heading', { level: 2, name: 'Herb of the day' }).closest('section, article, div');
  await user.click(screen.getAllByRole('button', { name: 'Try again' }).pop());
  expect(await screen.findByRole('link', { name: 'Lavender' })).toBeInTheDocument();
  expect(global.fetch.mock.calls.filter(c => String(c[0]).startsWith('/api/today')).length).toBe(before);
  expect(card).toBeTruthy();
});

// Sky ---------------------------------------------------------------------
const SKY = {
  day: '2026-10-09',
  phase: { name: 'waxing gibbous', group: 'waxing', illumination: 78 },
  moon: { sign: 'Taurus', element: 'Earth', changes: [] },
  ruler: 'Venus',
  festival: null,
  next_new: '2026-11-09T21:00:00.000Z',
  next_full: '2026-10-26T04:12:00.000Z',
  next_festival: { name: 'Samhain', day: '2026-10-31', in_days: 22 },
};
const withSky = (sky = {}, suggestions = []) => { summary = { ...summary, sky: { ...SKY, ...sky }, suggestions }; };

it('shows the sky line, the sooner of next full or new moon, and the next festival under the date', async () => {
  withSky();
  today();
  expect(await screen.findByText('Waxing gibbous in Taurus, Friday under Venus')).toBeInTheDocument();
  expect(screen.getByText(/^Next full moon \w{3}, Oct 2[5-6], \d{1,2}:\d{2} (AM|PM)$/)).toBeInTheDocument();
  expect(screen.queryByText(/Next new moon/)).toBeNull();
  expect(screen.getByText('Samhain in 22 days')).toBeInTheDocument();
});

it('shows the next new moon when it comes first', async () => {
  withSky({ next_new: '2026-10-20T10:00:00.000Z', next_full: '2026-11-04T10:00:00.000Z' });
  today();
  expect(await screen.findByText(/^Next new moon /)).toBeInTheDocument();
  expect(screen.queryByText(/Next full moon/)).toBeNull();
});

it('says when today is a festival', async () => {
  withSky({ festival: 'Samhain' });
  today();
  expect(await screen.findByText('Today is Samhain')).toBeInTheDocument();
  expect(screen.queryByText(/Samhain in/)).toBeNull();
});

it('lists a moon sign change today', async () => {
  withSky({ moon: { sign: 'Taurus', element: 'Earth', changes: [{ at: new Date(2026, 9, 9, 15, 12).toISOString(), sign: 'Gemini' }] } });
  today();
  expect(await screen.findByText('Moon enters Gemini at 3:12 PM')).toBeInTheDocument();
});

it('shows up to two suggestions, each labelled Folk tradition, in The sky today', async () => {
  withSky({}, [{ id: 1, text: 'Waxing moon: a time to start tinctures.' }, { id: 2, text: 'Venus day: good for rose and love blends.' }]);
  today();
  const card = await screen.findByRole('region', { name: 'The sky today' });
  expect(within(card).getByText("folk timing, for what you're making")).toBeInTheDocument();
  expect(within(card).getByText('Waxing moon: a time to start tinctures.')).toBeInTheDocument();
  expect(within(card).getAllByText('Folk tradition')).toHaveLength(2);
  expect(within(card).getByText('Waxing gibbous, 78% lit')).toBeInTheDocument();
  expect(within(card).getByRole('link', { name: 'Timing rules' })).toHaveAttribute('href', '/settings/timing-rules');
});

it('shows only sky facts and a note when suggestions are off', async () => {
  withSky({}, []);
  settings.sky_suggestions = 'off';
  today();
  const card = await screen.findByRole('region', { name: 'The sky today' });
  expect(await within(card).findByText('Suggestions are off. Turn them on in Settings.')).toBeInTheDocument();
  expect(within(card).queryByText('Folk tradition')).toBeNull();
  expect(within(card).getByText('Waxing gibbous, 78% lit')).toBeInTheDocument();
});

it('waits for settings before saying anything about suggestions', async () => {
  withSky({}, []);
  let release;
  const gate = new Promise(r => { release = r; });
  const base = global.fetch;
  global.fetch = vi.fn(async (url, ...rest) => {
    if (url === '/api/settings') { await gate; }
    return base(url, ...rest);
  });
  settings.sky_suggestions = 'off';
  today();
  const card = await screen.findByRole('region', { name: 'The sky today' });
  expect(within(card).getByText('Waxing gibbous, 78% lit')).toBeInTheDocument();
  expect(within(card).queryByText(/No folk timing for today/)).toBeNull();
  expect(within(card).queryByText(/Suggestions are off/)).toBeNull();
  expect(within(card).queryByText("folk timing, for what you're making")).toBeNull();
  await act(async () => { release(); });
  expect(await within(card).findByText('Suggestions are off. Turn them on in Settings.')).toBeInTheDocument();
  expect(within(card).getByText('the moon and the day')).toBeInTheDocument();
  expect(within(card).queryByText("folk timing, for what you're making")).toBeNull();
});

const task = (id, title, extra = {}) => ({ id, title, due_on: '2026-10-08', done_on: null, kind: 'manual', ...extra });

it('puts the Tasks card first and lists tasks with a done checkbox', async () => {
  summary = { ...summary, sky: { day: '2026-10-08', phase: { name: 'full', group: 'full', illumination: 99 }, moon: { sign: 'Aries', element: 'Fire', changes: [] }, ruler: 'Mars', festival: null, next_new: '2026-11-09T00:00:00.000Z', next_full: '2026-11-24T00:00:00.000Z', next_festival: null }, suggestions: [], tasks: [task(3, 'Water the sage'), task(4, 'Label jars')], counts: { ...summary.counts, tasks: 2 } };
  today();
  const card = await screen.findByRole('region', { name: 'Tasks' });
  expect(within(card).getByText('due today and overdue')).toBeInTheDocument();
  expect(within(card).getByRole('link', { name: 'Water the sage' })).toHaveAttribute('href', '/todo/3');
  expect(within(card).getByRole('checkbox', { name: 'Done: Label jars' })).not.toBeChecked();
  expect(within(card).getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/todo');
  const names = (await screen.findAllByRole('heading', { level: 2 })).map(h => h.textContent);
  expect(names.slice(0, 3)).toEqual(['Tasks', 'The sky today', 'Batches due']);
});

it('says nothing is due when there are no tasks today', async () => {
  today();
  const card = await screen.findByRole('region', { name: 'Tasks' });
  expect(within(card).getByText('Nothing due today.')).toBeInTheDocument();
});

it('completes a task from the Today card and reloads', async () => {
  summary = { ...summary, tasks: [task(3, 'Water the sage')], counts: { ...summary.counts, tasks: 1 } };
  today();
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Done: Water the sage' }));
  await vi.waitFor(() => expect(posts).toContain('/api/tasks/3/complete'));
});
