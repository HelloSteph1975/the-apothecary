import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const last = { supplier: { id: 2, name: 'Moonvale Herbs' }, price: 9.5, purchased_on: '2026-09-02', quantity: 100, unit: 'g' };
const low = (extra = {}) => ({
  key: 'low:7:0', kind: 'low', name: 'Nettle', amount: 12, unit: 'g', low_threshold: 50,
  item: { id: 7, name: 'Nettle', live: true }, section: { id: 1, name: 'Herbs' }, last, checked: false, ...extra,
});
const mine = (extra = {}) => ({
  key: 'item:3', kind: 'manual', id: 3, name: 'Beeswax pellets', quantity: '2 lb', notes: 'The yellow kind',
  section: { id: 1, name: 'Herbs', live: true }, supplier: null, herb: null, item: null, last: null, checked: false, ...extra,
});
const board = (rows, group = 'section') => ({
  group, groups: rows.length ? [{ key: group === 'section' ? 'section-1' : 'supplier-2', name: group === 'section' ? 'Herbs' : 'Moonvale Herbs', rows }] : [],
  counts: { open: rows.filter(r => !r.checked).length, checked: rows.filter(r => r.checked).length,
    checked_items: rows.filter(r => r.kind === 'manual' && r.checked).length },
});

let calls;
let rows;
let listFails;
let restockItem;
let clearReply;
let clearGate;
let itemGets;
beforeEach(() => {
  calls = [];
  rows = [low(), mine()];
  listFails = 0;
  clearReply = { stamp: '2026-10-11T10:00:00.000Z', cleared: 2 };
  itemGets = null;
  clearGate = null;
  restockItem = { id: 7, name: 'Nettle', unit: 'g', form: 'dried leaf', last_supplier_id: 2, status: {}, purchases: [], photos: [] };
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.startsWith('/api/shopping?')) {
      if (listFails > 0) { listFails -= 1; return json({ error: 'The list would not load.' }, 500); }
      return json(board(rows, new URL(url, 'http://x').searchParams.get('group')));
    }
    if (url === '/api/shopping/check') return json({ key: 'x', checked: true });
    if (url === '/api/shopping/clear') { if (clearGate) await clearGate; return json(clearReply); }
    if (url === '/api/shopping/clear/undo') return json({ restored: 2 });
    if (url === '/api/shopping/items' && method === 'POST') return json({ id: 4 }, 201);
    if (url === '/api/shopping/items/3' && method === 'PATCH') return json(mine());
    if (url === '/api/shopping/items/3' && method === 'DELETE') return json({ ok: true, restore: '/api/shopping/items/3/restore' });
    if (url === '/api/shopping/items/3/restore') return json(mine());
    if (itemGets && /^\/api\/items\/\d+\?/.test(url)) return itemGets(url, json);
    if (url.startsWith('/api/items/7?')) return json(restockItem);
    if (url === '/api/items/7/restock') return json({ ok: true }, 201);
    if (url === '/api/suppliers') return json([{ id: 2, name: 'Moonvale Herbs' }]);
    if (url.startsWith('/api/expiry-suggestion')) return json(null);
    if (url === '/api/sections') return json([{ id: 1, name: 'Herbs', kind: 'herb' }]);
    if (url === '/api/herbs') return json([]);
    if (url.startsWith('/api/items?')) return json([]);
    return json({});
  });
});
const open = (path = '/shopping') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const lastList = () => calls.filter(c => c.url.startsWith('/api/shopping?')).at(-1).url;
const listCount = () => calls.filter(c => c.url.startsWith('/api/shopping?')).length;

it('shows the header, a group card and both kinds of row', async () => {
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Shopping list' })).toBeInTheDocument();
  expect(screen.getByText('What the cabinet is running low on')).toBeInTheDocument();
  expect(await screen.findByRole('checkbox', { name: 'Nettle' })).toBeInTheDocument();
  expect(lastList()).toBe('/api/shopping?group=section');
  const card = screen.getByRole('region', { name: 'Herbs' });
  expect(within(card).getByRole('link', { name: 'Nettle' })).toHaveAttribute('href', '/cabinet/items/7');
  expect(within(card).getByText('12 g left, low at 50 g')).toBeInTheDocument();
  expect(within(card).getByText('Last from Moonvale Herbs, $9.50 on Sep 2')).toBeInTheDocument();
  expect(within(card).getByText('Beeswax pellets')).toBeInTheDocument();
  expect(within(card).getByText('2 lb')).toBeInTheDocument();
  expect(within(card).getByText('The yellow kind')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Nettle' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Beeswax pellets' })).not.toBeChecked();
});

it('says Used up for a used-up jar instead of the amount left', async () => {
  rows = [low({ amount: 1, unit: 'lb', low_threshold: 0.5, used_up: true })];
  open();
  const card = await screen.findByRole('region', { name: 'Herbs' });
  expect(await within(card).findByText('Used up')).toBeInTheDocument();
  expect(within(card).queryByText(/left, low at/)).toBeNull();
});

it('offers Restock, not Bought, for her item that points at a jar, and shows how the jar stands', async () => {
  const user = userEvent.setup();
  rows = [mine({ item: { id: 7, name: 'Nettle', live: true }, need: { used_up: true } })];
  open();
  const card = await screen.findByRole('region', { name: 'Herbs' });
  expect(await within(card).findByText('Used up')).toBeInTheDocument();
  expect(within(card).queryByRole('link', { name: 'Bought' })).toBeNull();
  await user.click(within(card).getByRole('button', { name: 'Restock' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(calls.some(c => c.url.startsWith('/api/items/7?'))).toBe(true);
});

it('groups by supplier from the URL and the toggle keeps it in the URL', async () => {
  const user = userEvent.setup();
  const router = open('/shopping?group=supplier');
  expect(await screen.findByRole('region', { name: 'Moonvale Herbs' })).toBeInTheDocument();
  expect(lastList()).toBe('/api/shopping?group=supplier');
  expect(screen.getByRole('link', { name: 'Supplier' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('link', { name: 'Section' }));
  await waitFor(() => expect(lastList()).toBe('/api/shopping?group=section'));
  expect(router.state.location.search).not.toContain('supplier');
  await user.click(screen.getByRole('link', { name: 'Supplier' }));
  await waitFor(() => expect(router.state.location.search).toBe('?group=supplier'));
});

it('checks a low jar and one of her items by key, then reloads', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('checkbox', { name: 'Nettle' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/shopping/check' && c.body.key === 'low:7:0' && c.body.checked === true)).toBe(true));
  await user.click(screen.getByRole('checkbox', { name: 'Beeswax pellets' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/shopping/check' && c.body.key === 'item:3' && c.body.checked === true)).toBe(true));
  await waitFor(() => expect(listCount()).toBeGreaterThan(2));
});

it('mutes a checked row and strikes its name through', async () => {
  rows = [low({ checked: true }), mine()];
  open();
  const box = await screen.findByRole('checkbox', { name: 'Nettle' });
  expect(box).toBeChecked();
  expect(box.closest('li')).toHaveClass('shopping-checked');
  expect(screen.getByRole('checkbox', { name: 'Beeswax pellets' }).closest('li')).not.toHaveClass('shopping-checked');
});

it('restocks a low jar from its own dialog and reloads the list', async () => {
  const user = userEvent.setup();
  open();
  const row = (await screen.findByRole('checkbox', { name: 'Nettle' })).closest('li');
  const before = listCount();
  await user.click(within(row).getByRole('button', { name: 'Restock' }));
  expect(await screen.findByRole('heading', { name: 'Restock Nettle' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Supplier')).toHaveValue('2'));
  await user.type(screen.getByLabelText(/^Quantity/), '100');
  const footer = document.querySelector('dialog[open] footer');
  await user.click(within(footer).getByRole('button', { name: 'Restock' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/items/7/restock' && c.body.quantity === 100 && c.body.supplier_id === 2)).toBe(true));
  await waitFor(() => expect(listCount()).toBeGreaterThan(before));
});

it('sends Bought on her item to the new jar form with the prefill', async () => {
  const user = userEvent.setup();
  const router = open();
  const row = (await screen.findByRole('checkbox', { name: 'Beeswax pellets' })).closest('li');
  expect(within(row).queryByRole('button', { name: 'Restock' })).not.toBeInTheDocument();
  const bought = within(row).getByRole('link', { name: 'Bought' });
  expect(bought).toHaveAttribute('href', '/cabinet/new?shopping=3');
  await user.click(bought);
  await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/cabinet/new?shopping=3'));
});

it('does not offer Bought, Edit or Delete on a low jar', async () => {
  open();
  const row = (await screen.findByRole('checkbox', { name: 'Nettle' })).closest('li');
  expect(within(row).queryByRole('link', { name: 'Bought' })).not.toBeInTheDocument();
  expect(within(row).queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  expect(within(row).queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
});

it('deletes her item with an undo', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('checkbox', { name: 'Beeswax pellets' });
  await user.click(screen.getByRole('button', { name: 'Delete Beeswax pellets' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/shopping/items/3')).toBe(true));
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/shopping/items/3/restore')).toBe(true));
});

it('edits her item in the dialog', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('checkbox', { name: 'Beeswax pellets' });
  await user.click(screen.getByRole('button', { name: 'Edit Beeswax pellets' }));
  const name = await screen.findByLabelText(/^Name/);
  expect(name).toHaveValue('Beeswax pellets');
  await user.clear(name);
  await user.type(name, 'White beeswax');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH' && c.url === '/api/shopping/items/3' && c.body.name === 'White beeswax')).toBe(true));
});

it('adds an item from the header button', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  await user.click(screen.getByRole('button', { name: 'Add an item' }));
  await user.type(await screen.findByLabelText(/^Name/), 'Amber bottles');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/shopping/items' && c.body.name === 'Amber bottles')).toBe(true));
});

it('disables Clear checked until something is checked', async () => {
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  expect(screen.getByRole('button', { name: 'Clear checked' })).toBeDisabled();
});

it('keeps Clear checked disabled when only a low jar is checked', async () => {
  rows = [low({ checked: true }), mine()];
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  expect(screen.getByRole('checkbox', { name: 'Nettle' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Clear checked' })).toBeDisabled();
});

it('offers no Undo when a clear removes nothing', async () => {
  const user = userEvent.setup();
  rows = [low(), mine({ checked: true })];
  clearReply = { stamp: '2026-10-11T10:00:00.000Z', cleared: 0 };
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  await user.click(screen.getByRole('button', { name: 'Clear checked' }));
  expect(await screen.findByText('Nothing of yours was checked')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
});

it('sends one clear for a double click', async () => {
  const user = userEvent.setup();
  rows = [low(), mine({ checked: true })];
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  let release;
  clearGate = new Promise(res => { release = res; });
  await user.dblClick(screen.getByRole('button', { name: 'Clear checked' }));
  release();
  await screen.findByRole('button', { name: 'Undo' });
  expect(calls.filter(c => c.url === '/api/shopping/clear')).toHaveLength(1);
});

it('opens the restock dialog for the jar clicked last, even when an earlier one answers last', async () => {
  const user = userEvent.setup();
  rows = [low(), low({ key: 'low:8:0', name: 'Comfrey', item: { id: 8, name: 'Comfrey', live: true } })];
  let releaseA;
  itemGets = (url, json) => {
    if (url.startsWith('/api/items/7?')) return new Promise(res => { releaseA = () => res(json({ ...restockItem, id: 7, name: 'Nettle' })); });
    return json({ ...restockItem, id: 8, name: 'Comfrey' });
  };
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  const buttons = screen.getAllByRole('button', { name: 'Restock' });
  await user.click(buttons[1]);
  await user.click(buttons[0]);
  await user.click(screen.getAllByRole('button', { name: 'Restock' })[1]);
  await waitFor(() => expect(calls.some(c => c.url.startsWith('/api/items/8?'))).toBe(true));
  await screen.findByRole('dialog');
  releaseA();
  await new Promise(r => setTimeout(r, 30));
  expect(screen.getByRole('dialog')).toHaveTextContent('Comfrey');
  expect(screen.getByRole('dialog')).not.toHaveTextContent('Nettle');
});

it('clears the checked rows and can undo it', async () => {
  const user = userEvent.setup();
  rows = [low({ checked: true }), mine({ checked: true })];
  open();
  await screen.findByRole('checkbox', { name: 'Nettle' });
  await user.click(screen.getByRole('button', { name: 'Clear checked' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/shopping/clear' && c.method === 'POST')).toBe(true));
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.url === '/api/shopping/clear/undo' && c.body.stamp === '2026-10-11T10:00:00.000Z')).toBe(true));
});

it('shows the empty state', async () => {
  rows = [];
  open();
  expect(await screen.findByText('Nothing to buy. Jars running low will show up here.')).toBeInTheDocument();
});

it('shows a failed load with Try again', async () => {
  const user = userEvent.setup();
  listFails = 1;
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('The list would not load.');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('checkbox', { name: 'Nettle' })).toBeInTheDocument();
});
