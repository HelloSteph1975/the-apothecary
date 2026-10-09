import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { todayString } from '../../client/src/lib/today.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

let calls;
let postFails;
let itemExtra;
let herbsFail;
beforeEach(() => {
  calls = [];
  postFails = false;
  itemExtra = {};
  herbsFail = false;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/sections') return json([{ id: 1, name: 'Herbs', kind: 'herb' }, { id: 2, name: 'Containers', kind: 'supply' }]);
    if (url === '/api/suppliers' && method === 'GET') return json([{ id: 2, name: 'Mountain Rose' }]);
    if (url === '/api/storage-spots') return json(['Pantry shelf']);
    if (url === '/api/herbs' && herbsFail) return json({ error: 'Herbs would not load.' }, 500);
    if (url === '/api/herbs') return json([{ id: 3, common_name: 'Lavender', latin_name: 'Lavandula angustifolia' }, { id: 4, common_name: 'Nettle', latin_name: 'Urtica dioica' }]);
    if (url.startsWith('/api/expiry-suggestion')) return json(url.includes('form=fresh') ? null : { expires_on: '2027-10-08' });
    if (url === '/api/items' && method === 'POST') {
      if (postFails) return json({ error: 'Please fix the highlighted fields.', details: { name: 'Required' } }, 400);
      return json({ id: 9 }, 201);
    }
    if (url.startsWith('/api/items/5')) {
      return json({ id: 5, name: 'Yarrow', section_id: 1, section_kind: 'herb', amount: 10, unit: 'g', form: 'dried leaf', acquired_on: '2026-09-01', source_kind: 'grown', expires_on: null, status: {}, purchases: [], photos: [], ...itemExtra });
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

it('fills in today as the date bought when Bought is picked on a new item', async () => {
  const user = userEvent.setup();
  open();
  await user.selectOptions(await screen.findByLabelText('Source'), 'Bought');
  expect(screen.getByLabelText('Date bought')).toHaveValue(todayString());
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

async function fillSuggested(user) {
  open();
  await user.selectOptions(await screen.findByLabelText(/^Section/), 'Herbs');
  await user.selectOptions(screen.getByLabelText('Source'), 'Bought');
  fireEvent.change(screen.getByLabelText('Date bought'), { target: { value: '2026-10-08' } });
  await user.selectOptions(screen.getByLabelText('Form'), 'dried leaf');
  await waitFor(() => expect(screen.getByLabelText('Use by')).toHaveValue('2027-10-08'));
}

it('clears a suggested use by date when the new form has no suggestion', async () => {
  const user = userEvent.setup();
  await fillSuggested(user);
  await user.selectOptions(screen.getByLabelText('Form'), 'fresh');
  await waitFor(() => expect(screen.getByLabelText('Use by')).toHaveValue(''));
  expect(screen.queryByText('Suggested from the form. Change it if you like.')).not.toBeInTheDocument();
});

it('keeps a typed use by date when the new form has no suggestion', async () => {
  const user = userEvent.setup();
  await fillSuggested(user);
  fireEvent.change(screen.getByLabelText('Use by'), { target: { value: '2028-01-01' } });
  const count = () => calls.filter(c => c.url.startsWith('/api/expiry-suggestion')).length;
  const before = count();
  await user.selectOptions(screen.getByLabelText('Form'), 'fresh');
  await user.click(screen.getByLabelText(/^Name/));
  expect(count()).toBe(before);
  expect(screen.getByLabelText('Use by')).toHaveValue('2028-01-01');
});

it('links a jar to a grimoire herb, filling empty names, and sends herb_id', async () => {
  const user = userEvent.setup();
  open();
  await user.selectOptions(await screen.findByLabelText(/^Section/), 'Herbs');
  const herb = await screen.findByLabelText('Grimoire herb');
  expect(screen.getByRole('option', { name: 'Not linked' })).toBeInTheDocument();
  await user.selectOptions(herb, 'Lavender');
  expect(screen.getByLabelText(/^Name/)).toHaveValue('Lavender');
  expect(screen.getByLabelText('Latin name')).toHaveValue('Lavandula angustifolia');
  await user.clear(screen.getByLabelText(/^Name/));
  await user.type(screen.getByLabelText(/^Name/), 'My lavender');
  await user.selectOptions(herb, 'Nettle');
  expect(screen.getByLabelText(/^Name/)).toHaveValue('My lavender');
  expect(screen.getByLabelText('Latin name')).toHaveValue('Lavandula angustifolia');
  await user.type(screen.getByLabelText(/^Amount/), '5');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/items')).toBe(true));
  expect(calls.find(c => c.method === 'POST' && c.url === '/api/items').body).toMatchObject({ herb_id: 4, name: 'My lavender' });
});

it('hides the grimoire herb select outside herb sections', async () => {
  open('/cabinet/new?section=2');
  await screen.findByLabelText(/^Section/);
  expect(screen.queryByLabelText('Grimoire herb')).not.toBeInTheDocument();
});

it('preselects the herb from the link', async () => {
  open('/cabinet/new?section=1&herb=4');
  expect(await screen.findByLabelText('Grimoire herb')).toHaveValue('4');
  await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('Nettle'));
  expect(screen.getByLabelText('Latin name')).toHaveValue('Urtica dioica');
});

it('switches to a herb section when the herb link has no section or a supply section', async () => {
  for (const path of ['/cabinet/new?herb=4', '/cabinet/new?section=2&herb=4']) {
    const view = open(path);
    expect(await screen.findByLabelText(/^Section/)).toHaveValue('1');
    expect(await screen.findByLabelText('Grimoire herb')).toHaveValue('4');
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('Nettle'));
    view.unmount();
  }
});

it('keeps the section from the link when there is no herb param', async () => {
  open('/cabinet/new?section=2');
  expect(await screen.findByLabelText(/^Section/)).toHaveValue('2');
});

it('leaves herb_id out of the save when the linked herb is deleted and untouched', async () => {
  const user = userEvent.setup();
  itemExtra = { herb_id: 3, herb_name: null };
  open('/cabinet/items/5/edit');
  await screen.findByLabelText('Grimoire herb');
  await user.type(screen.getByLabelText(/^Notes/), 'x');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH')).toBe(true));
  expect(calls.find(c => c.method === 'PATCH').body).not.toHaveProperty('herb_id');
});

it('sends herb_id when the linked herb is deleted and she picks another', async () => {
  const user = userEvent.setup();
  itemExtra = { herb_id: 3, herb_name: null };
  open('/cabinet/items/5/edit');
  await user.selectOptions(await screen.findByLabelText('Grimoire herb'), 'Nettle');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH')).toBe(true));
  expect(calls.find(c => c.method === 'PATCH').body.herb_id).toBe(4);
});

it('still sends herb_id when the linked herb is live', async () => {
  const user = userEvent.setup();
  itemExtra = { herb_id: 3, herb_name: 'Lavender' };
  open('/cabinet/items/5/edit');
  await screen.findByLabelText('Grimoire herb');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'PATCH')).toBe(true));
  expect(calls.find(c => c.method === 'PATCH').body.herb_id).toBe(3);
});

it('says the herb list did not load, with Try again, when adding a jar of a herb', async () => {
  const user = userEvent.setup();
  herbsFail = true;
  open('/cabinet/new?section=1&herb=4');
  expect(await screen.findByRole('alert')).toHaveTextContent(/herb list/i);
  herbsFail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByLabelText('Grimoire herb')).toHaveValue('4'));
});
