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

const today = todayString();
const baseItem = {
  id: 7, name: 'Nettle', latin_name: 'Urtica dioica', section_id: 1, section_name: 'Herbs', section_kind: 'herb',
  amount: 50, unit: 'g', size_label: '1 pint jar', low_threshold: 20, expires_on: '2026-10-20', storage_spot: 'Pantry shelf',
  form: 'dried leaf', plant_part: 'leaf', source_kind: 'bought', last_supplier_id: 2, last_supplier_name: 'Mountain Rose',
  used_up_at: null, notes: 'Second harvest', acquired_on: '2026-09-01',
  status: { low: false, expiring: true, expired: false },
  purchases: [
    { id: 11, supplier_id: 2, supplier_name: 'Mountain Rose', supplier_deleted_at: null, purchased_on: '2026-09-01', quantity: 100, unit: 'g', price: 9.5, order_note: 'First order' },
    { id: 12, supplier_id: 3, supplier_name: 'Old Shop', supplier_deleted_at: '2026-09-30', purchased_on: '2026-05-01', quantity: 50, unit: 'g', price: null, order_note: null },
  ],
  photos: [],
};

let item = baseItem;
let calls;
beforeEach(() => {
  calls = [];
  item = baseItem;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.startsWith('/api/items/7?')) return json(item);
    if (url === '/api/suppliers') return json([{ id: 2, name: 'Mountain Rose' }]);
    if (url.startsWith('/api/expiry-suggestion')) return json({ expires_on: '2027-10-08' });
    if (url === '/api/items/7/restock') return json({ ok: true }, 201);
    if (url === '/api/items/7' && method === 'PATCH') return json(item);
    if (url.startsWith('/api/purchases/') && method === 'PATCH') return json({ ok: true });
    if (url === '/api/items/7' && method === 'DELETE') return json({ ok: true, restore: '/api/items/7/restore' });
    if (url === '/api/sections' || url === '/api/storage-spots') return json([]);
    if (url.startsWith('/api/items?')) return json([]);
    return json({});
  });
});

const open = () => render(
  <ToastProvider><ConfirmProvider>
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/cabinet/items/7'] })} />
  </ConfirmProvider></ToastProvider>,
);
const itemGets = () => calls.filter(c => c.method === 'GET' && c.url.startsWith('/api/items/7?')).length;

it('shows the jar, badges, source and purchases', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'Nettle' })).toBeInTheDocument();
  expect(screen.getByText('Amount').nextElementSibling).toHaveTextContent('50 g');
  expect(screen.getByText('Use soon')).toBeInTheDocument();
  expect(screen.getByText('Bought from Mountain Rose')).toBeInTheDocument();
  expect(screen.getByText(/Reminds you at 20 g/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mountain Rose' })).toHaveAttribute('href', '/cabinet/suppliers/2');
  expect(screen.getByText(/\(removed\)/)).toBeInTheDocument();
});

it('shows dates in a friendly format', async () => {
  open();
  await screen.findByRole('heading', { name: 'Nettle' });
  expect(screen.getByText('Use by').nextElementSibling).toHaveTextContent('Oct 20, 2026');
  expect(screen.getByText('Sep 1, 2026')).toBeInTheDocument();
});

it('restocks with the last supplier and today as defaults', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Restock' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText(/^Quantity/), '24');
  const before = itemGets();
  await user.click(within(dialog).getByRole('button', { name: 'Restock' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/items/7/restock')).toBe(true));
  const post = calls.find(c => c.url === '/api/items/7/restock');
  expect(post.body).toMatchObject({ quantity: 24, supplier_id: 2, purchased_on: today });
  await waitFor(() => expect(itemGets()).toBeGreaterThan(before));
});

it('marks the item used up', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Mark used up' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH' && c.url === '/api/items/7')).toBe(true));
  expect(calls.find(c => c.method === 'PATCH').body).toEqual({ used_up: true });
});

it('asks before deleting, then returns to the shelves', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Keep it' })).toHaveFocus();
  expect(calls.some(c => c.method === 'DELETE')).toBe(false);
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/items/7')).toBe(true));
  expect(await screen.findByText('Your cabinet is empty')).toBeInTheDocument();
});

it('keeps keyboard focus when editing a purchase row', async () => {
  const user = userEvent.setup();
  open();
  const edit = await screen.findByRole('button', { name: 'Edit purchase from Sep 1, 2026' });
  await user.click(edit);
  expect(screen.getByLabelText('Date')).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Edit purchase from Sep 1, 2026' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Edit purchase from Sep 1, 2026' }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH' && c.url === '/api/purchases/11')).toBe(true));
  expect(screen.getByRole('button', { name: 'Edit purchase from Sep 1, 2026' })).toHaveFocus();
});

it('leaves the use by date out of the restock when the field is blank', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Restock' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText(/^Quantity/), '5');
  const useBy = within(dialog).getByLabelText('New use by');
  await waitFor(() => expect(useBy).toHaveValue('2027-10-08'));
  await user.clear(useBy);
  await user.click(within(dialog).getByRole('button', { name: 'Restock' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/items/7/restock')).toBe(true));
  expect(calls.find(c => c.url === '/api/items/7/restock').body).not.toHaveProperty('expires_on');
});

it('marks the restock quantity as required', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Restock' }));
  const quantity = within(screen.getByRole('dialog')).getByLabelText('Quantity (required)');
  expect(quantity).toBeRequired();
  expect(quantity).toHaveAttribute('aria-required', 'true');
});

it('does not default restock to a removed supplier', async () => {
  const user = userEvent.setup();
  item = { ...baseItem, last_supplier_id: 5, last_supplier_name: 'Gone Shop' };
  open();
  await user.click(await screen.findByRole('button', { name: 'Restock' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText(/^Quantity/), '3');
  await user.click(within(dialog).getByRole('button', { name: 'Restock' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/items/7/restock')).toBe(true));
  expect(calls.find(c => c.url === '/api/items/7/restock').body.supplier_id).toBeNull();
});

it('links to the grimoire herb when the jar is linked', async () => {
  item = { ...baseItem, herb_id: 3, herb_slug: 'nettle', herb_name: 'Nettle' };
  open();
  const link = await screen.findByRole('link', { name: 'Nettle' });
  expect(link).toHaveAttribute('href', '/grimoire/3');
  expect(link.closest('dd')).toHaveTextContent(/^Nettle$/);
  expect(link.closest('dd').previousElementSibling).toHaveTextContent('Grimoire');
});

it('shows no grimoire line when the jar is not linked', async () => {
  item = { ...baseItem, herb_id: null, herb_name: null };
  open();
  await screen.findByRole('heading', { name: 'Nettle' });
  expect(screen.queryByText('Grimoire', { selector: 'dt' })).not.toBeInTheDocument();
});
