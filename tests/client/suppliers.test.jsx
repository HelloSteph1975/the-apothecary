import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const list = [
  { id: 2, name: 'Mountain Rose', website: 'https://example.com', contact: null, good_for: 'Dried herbs', rating: 4, notes: null, purchase_count: 2, total_spent: 15.5, last_purchased_on: '2026-10-01', cover: null },
  { id: 3, name: 'Corner Shop', website: null, contact: null, good_for: null, rating: null, notes: null, purchase_count: 0, total_spent: 0, last_purchased_on: null, cover: null },
];
const detail = {
  id: 2, name: 'Mountain Rose', website: 'https://example.com', contact: 'Ask for Sam', good_for: 'Dried herbs', rating: 4, notes: 'Ships fast',
  purchases: [
    { id: 1, item_id: 7, item_name: 'Nettle', item_unit: 'g', item_size: null, purchased_on: '2026-10-01', quantity: 100, unit: 'g', price: 9.5, order_note: null },
    { id: 2, item_id: 8, item_name: 'Yarrow', item_unit: 'g', item_size: null, purchased_on: '2026-09-01', quantity: 50, unit: 'g', price: 6, order_note: null },
  ],
  photos: [],
};

let calls;
let postFails;
beforeEach(() => {
  calls = [];
  postFails = false;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/suppliers' && method === 'GET') return json(list);
    if (url === '/api/suppliers' && method === 'POST') {
      if (postFails) return json({ error: 'Please fix the highlighted fields.', details: { name: 'Required' } }, 400);
      return json({ id: 9 }, 201);
    }
    if (url === '/api/suppliers/2' && method === 'GET') return json(detail);
    if (url === '/api/suppliers/2' && method === 'PATCH') return json(detail);
    if (url === '/api/suppliers/2' && method === 'DELETE') return json({ ok: true, restore: '/api/suppliers/2/restore' });
    if (url === '/api/suppliers/9') return json({ ...detail, id: 9, name: 'New' });
    return json({});
  });
});

const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};

it('lists suppliers with totals, rating text and website link', async () => {
  open('/cabinet/suppliers');
  expect(await screen.findByRole('heading', { name: 'Herb cabinet' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Suppliers' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Add a supplier' })).toHaveAttribute('href', '/cabinet/suppliers/new');
  expect(await screen.findByRole('link', { name: 'Mountain Rose' })).toHaveAttribute('href', '/cabinet/suppliers/2');
  expect(screen.getByText('2 purchases, $15.50 spent, last on Oct 1, 2026')).toBeInTheDocument();
  expect(screen.getByText('Rated 4 out of 5')).toBeInTheDocument();
  expect(screen.getByText('Not rated')).toBeInTheDocument();
  expect(screen.getByText('No purchases yet.')).toBeInTheDocument();
  const site = screen.getByRole('link', { name: 'Website' });
  expect(site).toHaveAttribute('href', 'https://example.com');
  expect(site).toHaveAttribute('target', '_blank');
  expect(site).toHaveAttribute('rel', 'noopener noreferrer');
});

it('shows an empty state', async () => {
  global.fetch = vi.fn(async () => new Response('[]'));
  open('/cabinet/suppliers');
  expect(await screen.findByText('No suppliers yet')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Add a supplier' }).length).toBeGreaterThan(0);
});

it('rejects a web address without a scheme, then saves a valid one', async () => {
  const user = userEvent.setup();
  open('/cabinet/suppliers/new');
  const name = await screen.findByLabelText(/^Name/);
  expect(name).toBeRequired();
  expect(screen.getByLabelText(/^Name/)).toHaveAttribute('aria-required', 'true');
  await user.type(name, 'Herb Farm');
  await user.type(screen.getByLabelText('Website'), 'example.com');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter a web address starting with https://')).toBeInTheDocument();
  expect(calls.some(c => c.method === 'POST')).toBe(false);
  await user.clear(screen.getByLabelText('Website'));
  await user.type(screen.getByLabelText('Website'), 'https://example.com');
  await user.selectOptions(screen.getByLabelText('Rating'), '5');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find(c => c.method === 'POST')).toBeTruthy());
  expect(calls.find(c => c.method === 'POST').body).toMatchObject({ name: 'Herb Farm', website: 'https://example.com', rating: 5 });
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'New' })).toBeInTheDocument();
});

it('shows server field errors', async () => {
  postFails = true;
  const user = userEvent.setup();
  open('/cabinet/suppliers/new');
  await user.type(await screen.findByLabelText(/^Name/), 'x');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Required')).toBeInTheDocument();
});

it('asks before leaving a changed form', async () => {
  const user = userEvent.setup();
  open('/cabinet/suppliers/new');
  await user.type(await screen.findByLabelText(/^Name/), 'x');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
});

it('fills the form when editing and patches', async () => {
  const user = userEvent.setup();
  open('/cabinet/suppliers/2/edit');
  const name = await screen.findByLabelText(/^Name/);
  await waitFor(() => expect(name).toHaveValue('Mountain Rose'));
  expect(screen.getByLabelText('Rating')).toHaveValue('4');
  await user.selectOptions(screen.getByLabelText('Rating'), 'Not rated');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PATCH')?.body).toMatchObject({ rating: null }));
});

it('shows the history and total on the detail page', async () => {
  open('/cabinet/suppliers/2');
  expect(await screen.findByRole('heading', { name: 'Mountain Rose' })).toBeInTheDocument();
  expect(screen.getByText('Rated 4 out of 5')).toBeInTheDocument();
  const table = within(screen.getByRole('table'));
  expect(table.getByRole('link', { name: 'Nettle' })).toHaveAttribute('href', '/cabinet/items/7');
  expect(table.getByText('100 g')).toBeInTheDocument();
  expect(table.getByText('$9.50')).toBeInTheDocument();
  expect(table.getByText('Total spent')).toBeInTheDocument();
  expect(table.getByText('$15.50')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Show only these items on the shelves' })).toHaveAttribute('href', '/cabinet?supplier_id=2');
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/cabinet/suppliers/2/edit');
});

it('deletes with a confirmation and returns to the list', async () => {
  const user = userEvent.setup();
  const router = open('/cabinet/suppliers/2');
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/cabinet/suppliers'));
  expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/suppliers/2')).toBe(true);
});

it('never links an unsafe website', async () => {
  const bad = { ...list[0], website: 'javascript:alert(1)' };
  const fetchBase = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (url === '/api/suppliers') return new Response(JSON.stringify([bad]));
    if (url === '/api/suppliers/2') return new Response(JSON.stringify({ ...detail, website: bad.website }));
    return fetchBase(url, opts);
  });
  const first = open('/cabinet/suppliers');
  await screen.findByRole('link', { name: 'Mountain Rose' });
  expect(screen.queryByRole('link', { name: 'Website' })).not.toBeInTheDocument();
  expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  first.dispose();
});

it('never links an unsafe website on the detail page', async () => {
  const fetchBase = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) => (url === '/api/suppliers/2'
    ? new Response(JSON.stringify({ ...detail, website: 'javascript:alert(1)' })) : fetchBase(url, opts)));
  open('/cabinet/suppliers/2');
  await screen.findByRole('heading', { name: 'Mountain Rose' });
  expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  expect(screen.queryByText('Website')).not.toBeInTheDocument();
});
