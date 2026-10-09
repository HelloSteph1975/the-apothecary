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
  { id: 1, name: 'Salve', description: 'Waxy balms', icon: 'jar', is_topical: 1, wait_days: 0, shelf_life_days: 365, label_caution: 'Skin only', recipe_count: 2 },
  { id: 2, name: 'Tincture', description: '', icon: 'droplet', is_topical: 0, wait_days: 42, shelf_life_days: 730, label_caution: '', recipe_count: 0 },
  { id: 3, name: 'Tea blend', description: '', icon: 'cup', is_topical: 0, wait_days: null, shelf_life_days: null, label_caution: '', recipe_count: 1 },
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
    if (method === 'DELETE') {
      return url.includes('move_to') ? json({ ok: true, restore: '/api/recipe-types/1/restore' })
        : json({ error: 'Move its recipes first.', details: { recipes: 2 } }, 409);
    }
    if (method === 'POST' && url === '/api/recipe-types') {
      const body = JSON.parse(opts.body);
      return body.name === 'Salve' ? json({ error: 'Please fix the highlighted fields.', details: { name: 'You already have a type with this name.' } }, 400) : json({ id: 9, ...body }, 201);
    }
    if (method === 'PUT') return json(TYPES);
    if (url === '/api/recipe-types') return json(TYPES);
    return json({});
  });
});
const open = () => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/recipes/types'] })} /></ConfirmProvider></ToastProvider>);

it('lists types with days text and the skin badge', async () => {
  open();
  const salve = (await screen.findByText('Salve')).closest('li');
  expect(within(salve).getByText('Waxy balms')).toBeInTheDocument();
  expect(within(salve).getByText('For the skin')).toBeInTheDocument();
  expect(within(salve).getByText(/Ready when made/)).toBeInTheDocument();
  expect(within(salve).getByText(/1 year/)).toBeInTheDocument();
  const tincture = screen.getByText('Tincture').closest('li');
  expect(within(tincture).getByText(/6 weeks/)).toBeInTheDocument();
  expect(within(tincture).getByText(/2 years/)).toBeInTheDocument();
  expect(within(tincture).queryByText('For the skin')).toBeNull();
});

it('saves a new order with the ids', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Salve');
  await user.click(screen.getByRole('button', { name: 'Move Salve down' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PUT')?.body).toEqual({ ids: [2, 1, 3] }));
  expect(calls.find(c => c.method === 'PUT').url).toBe('/api/recipe-types/order');
});

it('asks where to move recipes before deleting', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Salve');
  await user.click(screen.getByRole('button', { name: 'Delete Salve' }));
  const group = await screen.findByRole('dialog', { name: 'Delete Salve' });
  await user.selectOptions(within(group).getByLabelText('Move its 2 recipes to'), '3');
  await user.click(within(group).getByRole('button', { name: 'Move and delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/recipe-types/1?move_to=3')).toBe(true));
  expect(await screen.findByText('Deleted Salve')).toBeInTheDocument();
});

it('adds a type with the right body and shows a duplicate-name error', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Salve');
  await user.click(screen.getByRole('button', { name: 'Add a type' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add a recipe type' });
  await user.type(within(dialog).getByLabelText('Name'), 'Salve');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(await within(dialog).findByText('You already have a type with this name.')).toBeInTheDocument();
  await user.clear(within(dialog).getByLabelText('Name'));
  await user.type(within(dialog).getByLabelText('Name'), 'Oil');
  await user.type(within(dialog).getByLabelText('Wait in days'), '14');
  await user.type(within(dialog).getByLabelText('Shelf life in days'), '180');
  await user.click(within(dialog).getByLabelText('For the skin (shows a patch-test reminder)'));
  await user.click(within(dialog).getByLabelText('Droplet'));
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.filter(c => c.method === 'POST' && c.url === '/api/recipe-types')).toHaveLength(2));
  expect(calls.filter(c => c.method === 'POST').at(-1).body).toEqual({
    name: 'Oil', description: null, wait_days: 14, shelf_life_days: 180, label_caution: null, is_topical: true, icon: 'droplet',
  });
});

it('reaches the icon picker with the keyboard', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Salve');
  await user.click(screen.getByRole('button', { name: 'Edit Tincture' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Tincture' });
  const picker = within(dialog).getByRole('radiogroup', { name: 'Icon' });
  expect(within(picker).getAllByRole('radio')).toHaveLength(14);
  expect(within(picker).getByLabelText('Droplet')).toBeChecked();
  within(picker).getByLabelText('Droplet').focus();
  await user.keyboard('{ArrowRight}');
  expect(within(picker).getByLabelText('Cup')).toBeChecked();
});
