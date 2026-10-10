import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { todayString } from '../../client/src/lib/today.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return todayString(d); };
const task = (id, extra) => ({
  id, title: `Task ${id}`, notes: null, due_on: day(0), repeat_kind: 'none', repeat_days: [], repeat_anchor_day: null, priority: 'normal',
  related: null, kind: 'manual', auto_key: null, snoozed_until: null, done_on: null, overdue: false, cover: null, ...extra,
});
let views;
let calls;
let location;
beforeEach(() => {
  calls = [];
  views = {
    today: [
      task(1, { title: 'Water the sage', due_on: day(0) }),
      task(2, { title: 'Stir the oil', due_on: day(-3), overdue: true, priority: 'high' }),
      task(3, { title: 'Restock lavender', kind: 'auto', auto_key: 'restock:1:0', related: { type: 'item', id: 7, name: 'Lavender jar', live: true } }),
      task(4, { title: 'Turn the compost', repeat_kind: 'weekly', repeat_days: [1, 4] }),
    ],
    upcoming: [task(5, { title: 'Bottle the tincture', due_on: day(1) }), task(6, { title: 'Order jars', due_on: day(9) })],
    area: { item: [task(3, { title: 'Restock lavender', related: { type: 'item', id: 7, name: 'Lavender jar', live: true } })], recipe: [], batch: [], herb: [], none: [task(1, { title: 'Water the sage' })] },
    done: [task(8, { title: 'Dry the mint', done_on: day(0) })],
  };
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    const m = /^\/api\/tasks\?view=(\w+)&today=(.+)$/.exec(url);
    if (m) return json(views[m[1]]);
    if (method === 'POST' && /\/complete$/.test(url)) {
      const spawn = url.includes('/4/');
      return json({ task: task(4, { done_on: day(0) }), next: spawn ? task(40, { due_on: day(4) }) : null });
    }
    if (method === 'DELETE') return json({ ok: true, restore: '/api/tasks/1/restore' });
    if (method === 'POST') return json({ ok: true });
    if (url.startsWith('/api/items')) return json([{ id: 7, name: 'Lavender jar' }]);
    return json({});
  });
});
const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  location = () => router.state.location;
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
};
const rowOf = title => screen.getByRole('link', { name: title }).closest('li');
const post = re => calls.find(c => c.method === 'POST' && re.test(c.url));
const views_nav = () => within(screen.getByRole('navigation', { name: 'To-do views' }));
const menu = async title => userEvent.click(within(rowOf(title)).getByRole('button', { name: `Actions for ${title}` }));

it('shows the heading, subtitle and four tabs, with Today selected by default', async () => {
  open('/todo');
  expect(await screen.findByRole('heading', { level: 1, name: 'To-do' })).toBeInTheDocument();
  expect(screen.getByText('What needs doing, and when')).toBeInTheDocument();
  expect(views_nav().getAllByRole('link').map(a => a.textContent)).toEqual(['Today', 'Upcoming', 'By area', 'Done']);
  expect(views_nav().getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  expect(await screen.findByText('Water the sage')).toBeInTheDocument();
});

it('keeps the tab in the URL', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  await userEvent.click(views_nav().getByRole('link', { name: 'Upcoming' }));
  expect(await screen.findByText('Bottle the tincture')).toBeInTheDocument();
  expect(location().search).toBe('?view=upcoming');
  expect(calls.some(c => c.url === `/api/tasks?view=upcoming&today=${todayString()}`)).toBe(true);
});

it('opens straight onto the tab named in the URL', async () => {
  open('/todo?view=done');
  expect(await screen.findByText('Dry the mint')).toBeInTheDocument();
});

it('shows due text, repeat, priority, related link and the automatic badge', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  expect(within(rowOf('Water the sage')).getByText('Today')).toBeInTheDocument();
  const overdue = within(rowOf('Stir the oil'));
  expect(overdue.getByText(/Overdue since/)).toHaveClass('overdue');
  expect(overdue.getByText('High')).toBeInTheDocument();
  const auto = within(rowOf('Restock lavender'));
  expect(auto.getByText('Automatic')).toBeInTheDocument();
  expect(auto.getByRole('link', { name: 'Lavender jar' })).toHaveAttribute('href', '/cabinet/items/7');
  expect(within(rowOf('Turn the compost')).getByText('Every Monday and Thursday')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Water the sage' })).toHaveAttribute('href', '/todo/1');
});

it('says Tomorrow for tomorrow', async () => {
  open('/todo?view=upcoming');
  await screen.findByText('Bottle the tincture');
  expect(within(rowOf('Bottle the tincture')).getByText('Tomorrow')).toBeInTheDocument();
});

it('groups by area', async () => {
  open('/todo?view=area');
  await screen.findByText('Restock lavender');
  expect(screen.getByRole('heading', { name: 'Jars' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument();
});

it('shows the empty states', async () => {
  views.today = []; views.upcoming = []; views.done = [];
  open('/todo');
  expect(await screen.findByText('Nothing due today. Enjoy the quiet.')).toBeInTheDocument();
  await userEvent.click(views_nav().getByRole('link', { name: 'Upcoming' }));
  expect(await screen.findByText('Nothing planned yet.')).toBeInTheDocument();
  await userEvent.click(views_nav().getByRole('link', { name: 'Done' }));
  expect(await screen.findByText('Nothing done yet.')).toBeInTheDocument();
});

it('checking a task completes it with the local day, and a repeat shows the next date', async () => {
  open('/todo');
  await screen.findByText('Turn the compost');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Turn the compost' }));
  await waitFor(() => expect(post(/\/api\/tasks\/4\/complete$/)).toBeTruthy());
  expect(post(/complete/).body).toEqual({ today: todayString() });
  expect(await screen.findByText(/^Next: /)).toBeInTheDocument();
});

it('does not show a Next line when nothing repeats', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Water the sage' }));
  await waitFor(() => expect(post(/\/api\/tasks\/1\/complete$/)).toBeTruthy());
  expect(screen.queryByText(/^Next: /)).toBeNull();
});

it('unchecking in Done reopens the task', async () => {
  open('/todo?view=done');
  const box = await screen.findByRole('checkbox', { name: 'Done: Dry the mint' });
  expect(box).toBeChecked();
  await userEvent.click(box);
  await waitFor(() => expect(post(/\/api\/tasks\/8\/uncomplete$/)).toBeTruthy());
});

it.each([['1 day', 1], ['3 days', 3], ['1 week', 7]])('snooze %s sends the right date', async (label, n) => {
  open('/todo');
  await screen.findByText('Water the sage');
  await menu('Water the sage');
  await userEvent.click(screen.getByRole('button', { name: `Snooze ${label}` }));
  await waitFor(() => expect(post(/\/api\/tasks\/1\/snooze$/)).toBeTruthy());
  expect(post(/snooze/).body).toEqual({ until: day(n), today: todayString() });
});

it('snoozes to a picked date', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  await menu('Water the sage');
  await userEvent.click(screen.getByRole('button', { name: 'Pick a date' }));
  const target = day(12);
  await userEvent.type(screen.getByLabelText('Snooze until'), target);
  await userEvent.click(screen.getByRole('button', { name: 'Snooze until that day' }));
  await waitFor(() => expect(post(/snooze/)).toBeTruthy());
  expect(post(/snooze/).body.until).toBe(target);
});

it('offers Dismiss only on automatic tasks and Delete only on manual ones', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  await menu('Water the sage');
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await menu('Restock lavender');
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
});

it('dismisses after confirming', async () => {
  open('/todo');
  await screen.findByText('Restock lavender');
  await menu('Restock lavender');
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  const dialog = (await screen.findByText('Dismiss this? It comes back only if things change.')).closest('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Dismiss' }));
  await waitFor(() => expect(post(/\/api\/tasks\/3\/dismiss$/)).toBeTruthy());
  expect(post(/dismiss/).body).toEqual({ today: todayString() });
});

it('deletes a manual task with an undo', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  await menu('Water the sage');
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = (await screen.findByText('Delete Water the sage?')).closest('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/tasks/1')).toBe(true));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(post(/\/api\/tasks\/1\/restore$/)).toBeTruthy());
});

it('a due prefill from the calendar opens the form with the date filled in', async () => {
  open(`/todo?due=${day(5)}`);
  expect(await screen.findByRole('dialog', { name: 'Add a task' })).toBeInTheDocument();
  expect(screen.getByLabelText('Due date')).toHaveValue(day(5));
});

it('Add a task opens an empty form', async () => {
  open('/todo');
  await screen.findByText('Water the sage');
  await userEvent.click(screen.getByRole('button', { name: 'Add a task' }));
  expect(await screen.findByLabelText('Title')).toHaveValue('');
});
