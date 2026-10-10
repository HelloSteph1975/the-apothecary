import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const sky = (day = '2026-10-31') => ({
  day,
  phase: { name: 'waxing gibbous', group: 'waxing', illumination: 82 },
  moon: { sign: 'Taurus', element: 'Earth', changes: [{ at: new Date(2026, 9, 31, 15, 12).toISOString(), sign: 'Gemini' }] },
  ruler: 'Saturn',
  festival: 'Samhain',
  next_new: '2026-11-09T00:00:00.000Z',
  next_full: '2026-11-24T00:00:00.000Z',
  next_festival: { name: 'Yule', in_days: 51 },
});
const ev = (kind, title, extra = {}) => ({ kind, day: '2026-10-31', title, link: `/${kind}/1`, done: false, overdue: false, id: 1, ...extra });

let calls;
let payload;
let settings;
let failOnce;
let location;
beforeEach(() => {
  calls = [];
  failOnce = false;
  settings = { keeper_name: '', sky_suggestions: 'on' };
  payload = {
    sky: sky(),
    suggestions: [{ id: 5, text: 'A good night for ancestor work.' }],
    events: [
      ev('task', 'Light a candle', { link: '/todo/7', id: 7 }),
      ev('step', 'Strain: Oil', { link: '/batches/2', id: 2 }),
      ev('expiry', 'Use up Rose', { link: '/cabinet/items/9', id: 9, overdue: true }),
    ],
  };
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url, method: opts.method ?? 'GET' });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json(settings);
    const m = /^\/api\/calendar\/day\/([\d-]+)$/.exec(url);
    if (m) {
      if (failOnce) { failOnce = false; return json({ error: 'The day would not open.' }, 500); }
      return json({ ...payload, sky: sky(m[1]) });
    }
    if (url.startsWith('/api/tasks?')) return json([]);
    if (/^\/api\/tasks\/\d+\/(un)?complete$/.test(url)) return json({ id: 7 });
    return json({});
  });
});
const open = async path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  location = () => router.state.location;
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  await screen.findByRole('heading', { level: 1 });
};
const cardOf = name => screen.getByRole('region', { name });

it('shows the long date, the sky line, and the sky card', async () => {
  await open('/calendar/2026-10-31');
  expect(await screen.findByRole('heading', { level: 1, name: 'Saturday, October 31, 2026' })).toBeInTheDocument();
  expect(screen.getByText('Waxing gibbous in Taurus, Saturday under Saturn')).toBeInTheDocument();
  await screen.findByRole('heading', { level: 2, name: 'Sky' });
  const card = cardOf('Sky');
  expect(within(card).getByText('Waxing gibbous, 82% lit')).toBeInTheDocument();
  expect(within(card).getByText(/Moon in Taurus/)).toBeInTheDocument();
  expect(within(card).getByText(/Moon enters Gemini at 3:12 PM/)).toBeInTheDocument();
  expect(within(card).getByText(/Ruled by Saturn/)).toBeInTheDocument();
  expect(within(card).getByText(/Samhain/)).toBeInTheDocument();
});

it('shows folk timing with its label', async () => {
  await open('/calendar/2026-10-31');
  await screen.findByRole('heading', { level: 2, name: 'Folk timing' });
  const card = cardOf('Folk timing');
  expect(within(card).getByText('A good night for ancestor work.')).toBeInTheDocument();
  expect(within(card).getByText('Folk tradition')).toBeInTheDocument();
});

it('hides folk timing when suggestions are off', async () => {
  settings.sky_suggestions = 'off';
  payload.suggestions = [];
  await open('/calendar/2026-10-31');
  await screen.findByRole('heading', { level: 2, name: 'Sky' });
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Folk timing' })).toBeNull());
});

it('lists what is due with links and a checkbox for tasks only', async () => {
  await open('/calendar/2026-10-31');
  await screen.findByRole('heading', { level: 2, name: 'Due this day' });
  expect(screen.getByRole('link', { name: 'Light a candle' })).toHaveAttribute('href', '/todo/7');
  expect(screen.getByRole('link', { name: 'Strain: Oil' })).toHaveAttribute('href', '/batches/2');
  expect(screen.getByRole('link', { name: 'Use up Rose' })).toHaveAttribute('href', '/cabinet/items/9');
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
});

it('says when nothing is due', async () => {
  payload.events = [];
  await open('/calendar/2026-10-31');
  expect(await screen.findByText('Nothing due on this day.')).toBeInTheDocument();
});

it('completes a task from its checkbox and reloads the day', async () => {
  const user = userEvent.setup();
  await open('/calendar/2026-10-31');
  await user.click(await screen.findByRole('checkbox', { name: 'Done: Light a candle' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/tasks/7/complete')).toBe(true));
  await waitFor(() => expect(calls.filter(c => c.url === '/api/calendar/day/2026-10-31').length).toBeGreaterThan(1));
});

it('shows a done task as checked', async () => {
  payload.events = [ev('task', 'Light a candle', { link: '/todo/7', id: 7, done: true })];
  await open('/calendar/2026-10-31');
  expect(await screen.findByRole('checkbox', { name: 'Done: Light a candle' })).toBeChecked();
});

it('opens the task form for this day', async () => {
  const user = userEvent.setup();
  await open('/calendar/2026-10-31');
  await user.click(await screen.findByRole('link', { name: 'Add a task for this day' }));
  expect(location().pathname).toBe('/todo');
  expect(location().search).toBe('?due=2026-10-31');
  expect(await screen.findByLabelText('Due date')).toHaveValue('2026-10-31');
});

it('links to a new batch starting on this day', async () => {
  await open('/calendar/2026-10-31');
  expect(await screen.findByRole('link', { name: 'Start a batch on this day' })).toHaveAttribute('href', '/batches/new?start=2026-10-31');
});

it('moves to the previous and next day', async () => {
  const user = userEvent.setup();
  await open('/calendar/2026-10-31');
  expect(await screen.findByRole('link', { name: 'Previous day' })).toHaveAttribute('href', '/calendar/2026-10-30');
  await user.click(screen.getByRole('link', { name: 'Next day' }));
  expect(location().pathname).toBe('/calendar/2026-11-01');
  expect(await screen.findByRole('heading', { level: 1, name: 'Sunday, November 1, 2026' })).toBeInTheDocument();
  expect(calls.some(c => c.url === '/api/calendar/day/2026-11-01')).toBe(true);
});

it('links back to the calendar month of this day', async () => {
  await open('/calendar/2026-10-31');
  expect(await screen.findByRole('link', { name: 'Back to the calendar' })).toHaveAttribute('href', '/calendar?date=2026-10-31');
});

it('shows an error with Try again', async () => {
  const user = userEvent.setup();
  failOnce = true;
  await open('/calendar/2026-10-31');
  expect(await screen.findByRole('alert')).toHaveTextContent('The day would not open.');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { level: 2, name: 'Sky' })).toBeInTheDocument();
});

it('treats a bad day as not found', async () => {
  await open('/calendar/2026-02-30');
  expect(await screen.findByText(/That page isn't in the cabinet/)).toBeInTheDocument();
  expect(calls.some(c => c.url.startsWith('/api/calendar/day/'))).toBe(false);
});
