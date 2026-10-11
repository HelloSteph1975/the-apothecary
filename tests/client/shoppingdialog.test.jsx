import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ShoppingItemDialog } from '../../client/src/screens/shopping/ShoppingItemDialog.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

let calls;
let saveError;
beforeEach(() => {
  calls = [];
  saveError = null;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/sections') return json([{ id: 1, name: 'Herbs', kind: 'herb' }, { id: 2, name: 'Containers', kind: 'supply' }]);
    if (url === '/api/suppliers') return json([{ id: 2, name: 'Moonvale Herbs' }]);
    if (url === '/api/herbs') return json([{ id: 3, common_name: 'Calendula', latin_name: 'Calendula officinalis' }]);
    if (url.startsWith('/api/items?')) return json([{ id: 7, name: 'Nettle', unit: 'g', amount: 12, status: {} }]);
    if (url.startsWith('/api/shopping/items')) {
      if (saveError) return json(saveError.body, saveError.status);
      return json({ id: 3 }, method === 'POST' ? 201 : 200);
    }
    return json({});
  });
});

const row = (extra = {}) => ({
  key: 'item:3', kind: 'manual', id: 3, name: 'Beeswax pellets', quantity: '2 lb', notes: 'The yellow kind',
  section: { id: 1, name: 'Herbs', live: true }, supplier: { id: 2, name: 'Moonvale Herbs', live: true },
  herb: null, item: null, last: null, checked: false, ...extra,
});
function show(item = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<ToastProvider><ShoppingItemDialog open item={item} onClose={onClose} onSaved={onSaved} /></ToastProvider>);
  return { onClose, onSaved };
}

it('needs a name before it saves', async () => {
  const user = userEvent.setup();
  const { onSaved } = show();
  await user.click(await screen.findByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Give the item a name.');
  expect(calls.some(c => c.method === 'POST')).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

it('adds an item with only the filled-in fields', async () => {
  const user = userEvent.setup();
  const { onSaved, onClose } = show();
  await user.type(await screen.findByLabelText(/^Name/), 'Amber bottles');
  await user.type(screen.getByLabelText('Quantity'), '12');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Containers' })).toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText('Section'), 'Containers');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
  expect(calls.find(c => c.method === 'POST' && c.url === '/api/shopping/items').body)
    .toEqual({ name: 'Amber bottles', quantity: '12', section_id: 2, supplier_id: null, herb_id: null, item_id: null, notes: null });
});

it('offers live herbs and jars', async () => {
  show();
  expect(await screen.findByRole('option', { name: 'Calendula' })).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: 'Nettle' })).toBeInTheDocument();
});

it('edits with her item filled in and PATCHes it', async () => {
  const user = userEvent.setup();
  const { onSaved } = show(row());
  const name = await screen.findByLabelText(/^Name/);
  expect(name).toHaveValue('Beeswax pellets');
  expect(screen.getByLabelText('Quantity')).toHaveValue('2 lb');
  expect(screen.getByLabelText('Notes')).toHaveValue('The yellow kind');
  await waitFor(() => expect(screen.getByLabelText('Supplier')).toHaveValue('2'));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(calls.find(c => c.method === 'PATCH').url).toBe('/api/shopping/items/3');
});

it('keeps a dead link selected and labelled, and sends it unchanged', async () => {
  const user = userEvent.setup();
  const { onSaved } = show(row({ supplier: { id: 9, name: 'Old Shop', live: false }, herb: { id: 8, name: 'Sage', live: false } }));
  expect(await screen.findByRole('option', { name: 'Old Shop (no longer here)' })).toBeInTheDocument();
  expect(screen.getByLabelText('Supplier')).toHaveValue('9');
  expect(screen.getByLabelText('Herb')).toHaveValue('8');
  expect(screen.getByRole('option', { name: 'Sage (no longer here)' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(calls.find(c => c.method === 'PATCH').body).toMatchObject({ supplier_id: 9, herb_id: 8 });
});

it('shows server field errors inline and stays open', async () => {
  const user = userEvent.setup();
  saveError = { status: 400, body: { error: 'Please fix the highlighted fields.', details: { supplier_id: 'That supplier does not exist' } } };
  const { onSaved, onClose } = show(row());
  await screen.findByLabelText(/^Name/);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('That supplier does not exist')).toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it('shows a message with no field as an inline alert', async () => {
  const user = userEvent.setup();
  saveError = { status: 404, body: { error: 'That item is not on the shopping list.' } };
  show(row());
  await screen.findByLabelText(/^Name/);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That item is not on the shopping list.');
});

it('creates one item when Enter is pressed twice in one tick', async () => {
  const user = userEvent.setup();
  show();
  const name = await screen.findByLabelText(/^Name/);
  await user.type(name, 'Amber bottles');
  const form = name.closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/shopping/items')).toBe(true));
  expect(calls.filter(c => c.method === 'POST' && c.url === '/api/shopping/items')).toHaveLength(1);
});
