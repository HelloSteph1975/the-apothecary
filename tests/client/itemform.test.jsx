import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

let calls;
let postFails;
beforeEach(() => {
  calls = [];
  postFails = false;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/sections') return json([{ id: 1, name: 'Herbs', kind: 'herb' }, { id: 2, name: 'Containers', kind: 'supply' }]);
    if (url === '/api/suppliers' && method === 'GET') return json([{ id: 2, name: 'Mountain Rose' }]);
    if (url === '/api/storage-spots') return json(['Pantry shelf']);
    if (url.startsWith('/api/expiry-suggestion')) return json({ expires_on: '2027-10-08' });
    if (url === '/api/items' && method === 'POST') {
      if (postFails) return json({ error: 'Please fix the highlighted fields.', details: { name: 'Required' } }, 400);
      return json({ id: 9 }, 201);
    }
    if (url.startsWith('/api/items/5')) {
      return json({ id: 5, name: 'Yarrow', section_id: 1, section_kind: 'herb', amount: 10, unit: 'g', form: 'dried leaf', acquired_on: '2026-09-01', source_kind: 'grown', expires_on: null, status: {}, purchases: [], photos: [] });
    }
    if (url.startsWith('/api/items/9')) return json({ id: 9, name: 'Nettle', amount: 50, unit: 'g', status: {}, purchases: [], photos: [] });
    return json({});
  });
});

const open = (path = '/cabinet/new') => render(
  <ToastProvider><ConfirmProvider>
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
  </ConfirmProvider></ToastProvider>,
);

it('shows the herb fields only for a herb section', async () => {
  const user = userEvent.setup();
  open();
  const section = await screen.findByLabelText(/^Section/);
  await user.selectOptions(section, 'Herbs');
  expect(screen.getByLabelText('Latin name')).toBeInTheDocument();
  expect(screen.getByLabelText('Form')).toBeInTheDocument();
  expect(screen.getByLabelText('Plant part')).toBeInTheDocument();
  await user.selectOptions(section, 'Containers');
  expect(screen.queryByLabelText('Latin name')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Form')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Plant part')).not.toBeInTheDocument();
});

it('preselects the section from the link', async () => {
  open('/cabinet/new?section=2');
  expect(await screen.findByLabelText(/^Section/)).toHaveValue('2');
});

it('shows source fields for bought, foraged and gifted', async () => {
  const user = userEvent.setup();
  open();
  const source = await screen.findByLabelText('Source');
  await user.selectOptions(source, 'Bought');
  expect(screen.getByLabelText('Supplier')).toBeInTheDocument();
  expect(screen.getByLabelText('Price')).toBeInTheDocument();
  expect(screen.getByLabelText('Date bought')).toBeInTheDocument();
  await user.selectOptions(source, 'Foraged');
  expect(screen.getByLabelText('Place')).toBeInTheDocument();
  expect(screen.queryByLabelText('Supplier')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Date harvested or made')).toBeInTheDocument();
  await user.selectOptions(source, 'Gifted or traded');
  expect(screen.getByLabelText('From whom')).toBeInTheDocument();
});

it('suggests a use by date but never overwrites one she typed', async () => {
  const user = userEvent.setup();
  open();
  await user.selectOptions(await screen.findByLabelText(/^Section/), 'Herbs');
  await user.selectOptions(screen.getByLabelText('Source'), 'Bought');
  fireEvent.change(screen.getByLabelText('Date bought'), { target: { value: '2026-10-08' } });
  await user.selectOptions(screen.getByLabelText('Form'), 'dried leaf');
  await waitFor(() => expect(screen.getByLabelText('Use by')).toHaveValue('2027-10-08'));
  expect(calls.some(c => c.url === '/api/expiry-suggestion?form=dried%20leaf&acquired_on=2026-10-08')).toBe(true);
  expect(screen.getByText('Suggested from the form. Change it if you like.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Use by'), { target: { value: '2028-01-01' } });
  const count = () => calls.filter(c => c.url.startsWith('/api/expiry-suggestion')).length;
  const before = count();
  await user.selectOptions(screen.getByLabelText('Form'), 'root');
  await user.click(screen.getByLabelText(/^Name/));
  expect(count()).toBe(before);
  expect(screen.getByLabelText('Use by')).toHaveValue('2028-01-01');
});

it('saves a new bought item and shows server errors under the field', async () => {
  const user = userEvent.setup();
  postFails = true;
  open();
  await user.selectOptions(await screen.findByLabelText(/^Section/), 'Containers');
  await user.type(screen.getByLabelText(/^Name/), 'Amber bottle');
  await user.type(screen.getByLabelText(/^Amount/), '12');
  await user.selectOptions(screen.getByLabelText('Unit'), 'Count');
  await user.selectOptions(screen.getByLabelText('Source'), 'Bought');
  await user.selectOptions(screen.getByLabelText('Supplier'), 'Mountain Rose');
  await user.type(screen.getByLabelText('Price'), '8.5');
  fireEvent.change(screen.getByLabelText('Date bought'), { target: { value: '2026-10-08' } });
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Required')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');

  postFails = false;
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Nettle' })).toBeInTheDocument());
  const post = calls.filter(c => c.method === 'POST' && c.url === '/api/items').at(-1);
  expect(post.body).toMatchObject({
    section_id: 2, name: 'Amber bottle', amount: 12, unit: 'count', source_kind: 'bought', acquired_on: '2026-10-08',
    purchase: { supplier_id: 2, purchased_on: '2026-10-08', price: 8.5 },
  });
});

it('asks before leaving with unsaved changes', async () => {
  const user = userEvent.setup();
  open();
  await user.type(await screen.findByLabelText(/^Name/), 'Mint');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Name/)).toHaveValue('Mint');
});

it('marks the required fields', async () => {
  open();
  expect(await screen.findByLabelText(/^Name/)).toBeRequired();
  expect(screen.getByLabelText(/^Amount/)).toHaveAttribute('aria-required', 'true');
  expect(screen.getByText('Name (required)')).toBeInTheDocument();
});

it('does not suggest a date or prompt when an untouched edit form is cancelled', async () => {
  const user = userEvent.setup();
  open('/cabinet/items/5/edit');
  expect(await screen.findByRole('heading', { name: 'Edit Yarrow' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByRole('heading', { name: 'Yarrow' })).toBeInTheDocument();
  expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
  expect(calls.some(c => c.url.startsWith('/api/expiry-suggestion'))).toBe(false);
});
