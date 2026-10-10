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

let calls;
let failCreate;
let taskRow;
beforeEach(() => {
  calls = [];
  failCreate = null;
  taskRow = null;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url.startsWith('/api/tasks?')) return json([]);
    if (method === 'POST' && url === '/api/tasks') await new Promise(r => setTimeout(r, 150));
    if (method === 'POST' && url === '/api/tasks') return failCreate ? json(failCreate.body, failCreate.status) : json({ id: 90 }, 201);
    if (method === 'PATCH' && url.startsWith('/api/tasks/')) return json({ ...taskRow, id: 12 });
    if (/^\/api\/tasks\/12/.test(url)) return json(taskRow);
    if (url.startsWith('/api/items')) return json([{ id: 7, name: 'Lavender jar' }, { id: 8, name: 'Mint jar' }]);
    if (url.startsWith('/api/recipes')) return json([{ id: 3, name: 'Calendula salve' }]);
    if (url.startsWith('/api/batches')) return json([{ id: 4, name: 'Winter tincture' }]);
    if (url.startsWith('/api/herbs')) return json([{ id: 5, common_name: 'Sage' }]);
    return json({});
  });
});
let location;
const open = path => { const router = createMemoryRouter(routes, { initialEntries: [path] }); location = () => router.state.location; return render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>); };
const body = () => calls.find(c => c.method === 'POST' && c.url === '/api/tasks')?.body;

it('needs a title', async () => {
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Write what needs doing.')).toBeInTheDocument();
  expect(body()).toBeUndefined();
});

it('shows weekday checkboxes only for a weekly repeat, in a fieldset', async () => {
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  expect(screen.queryByRole('group', { name: 'Repeat on' })).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'weekly');
  expect(screen.getByRole('group', { name: 'Repeat on' })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'daily');
  expect(screen.queryByRole('group', { name: 'Repeat on' })).toBeNull();
});

it('sends the right body for a weekly task about a jar', async () => {
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  await userEvent.type(screen.getByLabelText('Title'), '  Check the jars ');
  await userEvent.type(screen.getByLabelText('Notes'), 'Lids too');
  await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'weekly');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Monday' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Thursday' }));
  await userEvent.selectOptions(screen.getByLabelText('Priority'), 'high');
  await userEvent.selectOptions(screen.getByLabelText('Related to'), 'item');
  await waitFor(() => expect(within(screen.getByLabelText('Which one')).getByRole('option', { name: 'Mint jar' })).toBeInTheDocument());
  await userEvent.selectOptions(screen.getByLabelText('Which one'), '8');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(body()).toBeTruthy());
  expect(body()).toEqual({
    title: 'Check the jars', notes: 'Lids too', due_on: '2026-10-20', repeat_kind: 'weekly', repeat_days: [1, 4],
    priority: 'high', related_type: 'item', related_id: 8, today: todayString(),
  });
});

it('sends nulls for blank optional fields', async () => {
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  await userEvent.type(screen.getByLabelText('Title'), 'Plain');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(body()).toBeTruthy());
  expect(body()).toMatchObject({ notes: null, repeat_kind: 'none', repeat_days: [], priority: 'normal', related_type: null, related_id: null });
});

it('prefills the related record from ?related=', async () => {
  open('/todo?related=herb:5');
  await screen.findByRole('dialog', { name: 'Add a task' });
  expect(screen.getByLabelText('Related to')).toHaveValue('herb');
  await waitFor(() => expect(screen.getByLabelText('Which one')).toHaveValue('5'));
});

it('shows a field error from the server, and saves only once on a double click', async () => {
  failCreate = { status: 400, body: { error: 'Please fix the highlighted fields.', details: { due_on: 'Use a real date' } } };
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  await userEvent.type(screen.getByLabelText('Title'), 'Oops');
  await userEvent.dblClick(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Use a real date')).toBeInTheDocument();
  expect(calls.filter(c => c.method === 'POST' && c.url === '/api/tasks')).toHaveLength(1);
});

it('shows a general error inline when there are no field details', async () => {
  failCreate = { status: 500, body: { error: 'Something went wrong' } };
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  await userEvent.type(screen.getByLabelText('Title'), 'Oops');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
});

it('an automatic task shows only the fields she can change, plus where it came from', async () => {
  taskRow = {
    id: 12, title: 'Restock lavender', notes: null, due_on: '2026-10-20', repeat_kind: 'none', repeat_days: [], repeat_anchor_day: null, priority: 'normal',
    related: { type: 'item', id: 7, name: 'Lavender jar', live: true }, kind: 'auto', auto_key: 'restock:7:0', snoozed_until: null, done_on: null,
    overdue: false, cover: null, photos: [],
  };
  open('/todo/12');
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
  expect(within(dialog).getByText('Made by the app from Lavender jar')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Title')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Notes')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Priority')).toBeInTheDocument();
  for (const label of ['Due date', 'Repeat', 'Related to']) expect(within(dialog).queryByLabelText(label)).toBeNull();
  await userEvent.clear(within(dialog).getByLabelText('Title'));
  await userEvent.type(within(dialog).getByLabelText('Title'), 'Restock the lavender');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH')).toBe(true));
  expect(calls.find(c => c.method === 'PATCH').body).toEqual({ title: 'Restock the lavender', notes: null, priority: 'normal' });
});

it('saving a prefilled form closes it without a leave warning and clears the prefill from the URL', async () => {
  open('/todo?due=2026-10-20');
  await screen.findByRole('dialog', { name: 'Add a task' });
  await userEvent.type(screen.getByLabelText('Title'), 'Sweep');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(location().search).toBe(''));
  expect(screen.queryByText('Leave without saving?')).toBeNull();
});
