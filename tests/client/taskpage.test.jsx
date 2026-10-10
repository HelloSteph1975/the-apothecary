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

const base = {
  id: 12, title: 'Check the jars', notes: 'Lids too', due_on: '2026-10-20', repeat_kind: 'monthly', repeat_days: [], repeat_anchor_day: 31, priority: 'high',
  related: { type: 'recipe', id: 3, name: 'Calendula salve', live: true }, kind: 'manual', auto_key: null, snoozed_until: null, done_on: null,
  overdue: false, cover: 'a.jpg', photos: [{ id: 1, filename: 'a.jpg', caption: 'Shelf', is_cover: 1, sort_order: 0 }],
};
let current;
let calls;
let slow;
beforeEach(() => {
  slow = 0;
  current = base;
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (slow && method !== 'GET') await new Promise(r => setTimeout(r, slow));
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (method === 'DELETE') return json({ ok: true, restore: '/api/tasks/12/restore' });
    if (method === 'POST' && /complete$/.test(url)) return json({ task: { ...current, done_on: todayString() }, next: null });
    if (method === 'POST') return json({ ok: true });
    if (url.startsWith('/api/tasks/12')) return json(current);
    return json({});
  });
});
const open = path => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></ConfirmProvider></ToastProvider>);

it('shows the fields as text, the related link and the photos', async () => {
  open('/todo/12');
  expect(await screen.findByRole('heading', { level: 1, name: 'Check the jars' })).toBeInTheDocument();
  expect(screen.getByText('Lids too')).toBeInTheDocument();
  expect(screen.getByText('Every month on the 31st')).toBeInTheDocument();
  expect(screen.getByText('High priority')).toBeInTheDocument();
  expect(screen.getByText('Oct 20, 2026')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Calendula salve' })).toHaveAttribute('href', '/recipes/3');
  expect(screen.getByRole('img', { name: 'Shelf' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
});

it('marks it done with the local day', async () => {
  open('/todo/12');
  await userEvent.click(await screen.findByRole('button', { name: 'Done' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/tasks/12/complete')).toBe(true));
  expect(calls.find(c => /complete/.test(c.url)).body).toEqual({ today: todayString() });
});

it('a double click on Done sends one request', async () => {
  slow = 150;
  open('/todo/12');
  const btn = await screen.findByRole('button', { name: 'Done' });
  await userEvent.click(btn);
  await userEvent.click(btn);
  expect(btn).toHaveAttribute('aria-disabled', 'true');
  await waitFor(() => expect(calls.some(c => c.url === '/api/tasks/12/complete')).toBe(true));
  expect(calls.filter(c => c.url === '/api/tasks/12/complete')).toHaveLength(1);
});

it('a double click on Undo done sends one request', async () => {
  slow = 150;
  current = { ...base, done_on: '2026-10-10' };
  open('/todo/12');
  const btn = await screen.findByRole('button', { name: 'Undo done' });
  await userEvent.click(btn);
  await userEvent.click(btn);
  await waitFor(() => expect(calls.some(c => c.url === '/api/tasks/12/uncomplete')).toBe(true));
  expect(calls.filter(c => c.url === '/api/tasks/12/uncomplete')).toHaveLength(1);
});

it('offers Undo done on a finished task', async () => {
  current = { ...base, done_on: '2026-10-10' };
  open('/todo/12');
  await userEvent.click(await screen.findByRole('button', { name: 'Undo done' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/tasks/12/uncomplete')).toBe(true));
});

it('offers Dismiss instead of Delete on an automatic task', async () => {
  current = { ...base, kind: 'auto', auto_key: 'restock:3:0', related: { type: 'item', id: 3, name: 'Mint jar', live: true } };
  open('/todo/12');
  await screen.findByRole('heading', { level: 1, name: 'Check the jars' });
  expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  expect(screen.getByText('Automatic')).toBeInTheDocument();
});

it('shows a friendly error with Try again when the task is gone', async () => {
  global.fetch = vi.fn(async url => {
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    return json({ error: 'That task is not on the list.' }, 404);
  });
  open('/todo/12');
  expect(await screen.findByRole('alert')).toHaveTextContent('That task is not on the list.');
  expect(within(document.body).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
