import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const TYPES = [
  { id: 1, name: 'Ritual', description: 'A working', icon: 'sparkles', entry_count: 2 },
  { id: 2, name: 'Dream', description: '', icon: 'cloud', entry_count: 0 },
  { id: 3, name: 'Note', description: '', icon: 'pen', entry_count: 1 },
];
let calls;
beforeEach(() => {
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (method === 'DELETE') return json({ ok: true, restore: `${url.split('?')[0]}/restore` });
    if (method === 'POST' && url === '/api/journal-types') {
      const body = JSON.parse(opts.body);
      return body.name === 'Ritual'
        ? json({ error: 'Please fix the highlighted fields.', details: { name: 'You already have a type with this name.' } }, 400)
        : json({ id: 9, ...body }, 201);
    }
    if (method === 'POST') return json({});
    if (method === 'PATCH') return json({ id: 2 });
    if (method === 'PUT') return json(TYPES);
    if (url === '/api/journal-types') return json(TYPES);
    return json({});
  });
});
const open = () => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/journal/types'] })} /></ConfirmProvider></ToastProvider>);

it('lists types in order with icon and entry count', async () => {
  open();
  const ritual = (await screen.findByText('Ritual')).closest('li');
  expect(within(ritual).getByText('A working')).toBeInTheDocument();
  expect(within(ritual).getByText('2 entries')).toBeInTheDocument();
  expect(within(screen.getByText('Note').closest('li')).getByText('1 entry')).toBeInTheDocument();
  const names = [...document.querySelectorAll('.type-row strong')].map(n => n.textContent);
  expect(names).toEqual(['Ritual', 'Dream', 'Note']);
  expect(screen.getByRole('link', { name: 'Back to the journal' })).toHaveAttribute('href', '/journal');
});

it('saves a new order with the ids', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Ritual');
  await user.click(screen.getByRole('button', { name: 'Move Ritual down' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PUT')?.body).toEqual({ ids: [2, 1, 3] }));
  expect(calls.find(c => c.method === 'PUT').url).toBe('/api/journal-types/order');
});

it('asks where to move entries before deleting, and can undo', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Ritual');
  await user.click(screen.getByRole('button', { name: 'Delete Ritual' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete Ritual' });
  await user.selectOptions(within(dialog).getByLabelText('Move its 2 entries to'), '3');
  await user.click(within(dialog).getByRole('button', { name: 'Move and delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/journal-types/1?move_to=3')).toBe(true));
  expect(await screen.findByText('Deleted Ritual')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/journal-types/1/restore')).toBe(true));
});

it('deletes a type with no entries after confirming', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Dream');
  await user.click(screen.getByRole('button', { name: 'Delete Dream' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/journal-types/2')).toBe(true));
  expect(await screen.findByText('Deleted Dream')).toBeInTheDocument();
});

it('adds a type with the right body and shows a duplicate-name error', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Ritual');
  await user.click(screen.getByRole('button', { name: 'Add a type' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add an entry type' });
  await user.type(within(dialog).getByLabelText('Name'), 'Ritual');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(await within(dialog).findByText('You already have a type with this name.')).toBeInTheDocument();
  await user.clear(within(dialog).getByLabelText('Name'));
  await user.type(within(dialog).getByLabelText('Name'), 'Spellwork');
  await user.click(within(dialog).getByLabelText('Flame'));
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.filter(c => c.method === 'POST' && c.url === '/api/journal-types')).toHaveLength(2));
  expect(calls.filter(c => c.method === 'POST').at(-1).body).toEqual({ name: 'Spellwork', description: null, icon: 'flame' });
});

it('edits a type and offers all twelve icons', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Dream');
  await user.click(screen.getByRole('button', { name: 'Edit Dream' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Dream' });
  const picker = within(dialog).getByRole('radiogroup', { name: 'Icon' });
  expect(within(picker).getAllByRole('radio')).toHaveLength(12);
  expect(within(picker).getByLabelText('Cloud')).toBeChecked();
  await user.type(within(dialog).getByLabelText('Description'), 'Night visions');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ name: 'Dream', description: 'Night visions', icon: 'cloud' }));
  expect(calls.find(c => c.method === 'PATCH').url).toBe('/api/journal-types/2');
});
