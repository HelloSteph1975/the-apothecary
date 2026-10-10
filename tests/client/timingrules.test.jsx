import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const rule = (id, extra) => ({ id, slug: `r${id}`, kind: 'phase_group', value: 'waxing', text: 'A growing moon.', weight: 2, sort_order: id * 10, recipe_types: [], planets: [], elements: [], ...extra });
const RULES = [
  rule(1, { text: 'Waxing text.', recipe_types: ['tincture'] }),
  rule(2, { kind: 'moon_element', value: 'Water', text: 'Water text.', weight: 3, elements: ['Water'], planets: ['Moon'] }),
  rule(3, { kind: 'moon_sign', value: 'Taurus', text: 'Taurus text.', weight: 1 }),
];
const TYPES = [
  { id: 1, slug: 'tincture', name: 'Tincture' },
  { id: 2, slug: 'tea-blend', name: 'Tea blend' },
  { id: 3, slug: null, name: 'Bath salts' },
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
    if (url === '/api/recipe-types') return json(TYPES);
    if (method === 'DELETE') return json({ ok: true, restore: '/api/timing-rules/1/restore' });
    if (method === 'POST' && url === '/api/timing-rules') {
      const body = JSON.parse(opts.body);
      return body.text === 'bad' ? json({ error: 'Please fix the highlighted fields.', details: { text: 'Use 300 characters or fewer' } }, 400) : json({ id: 9, ...body }, 201);
    }
    if (method === 'PUT' && url === '/api/timing-rules/order') return json(RULES);
    if (method === 'PATCH') return json({ ok: true });
    if (url === '/api/timing-rules') return json(RULES);
    return json({});
  });
});
const open = () => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings/timing-rules'] })} /></ConfirmProvider></ToastProvider>);

it('lists rules in order with kind, text, weight and what they favour', async () => {
  open();
  const first = (await screen.findByText('Waxing text.')).closest('li');
  expect(within(first).getByText('Waxing moon')).toBeInTheDocument();
  expect(within(first).getByText('Medium')).toBeInTheDocument();
  expect(within(first).getByText(/Tincture/)).toBeInTheDocument();
  const second = screen.getByText('Water text.').closest('li');
  expect(within(second).getByText('Moon in a water sign')).toBeInTheDocument();
  expect(within(second).getByText('Strong')).toBeInTheDocument();
  expect(within(second).getByText(/Planets: Moon/)).toBeInTheDocument();
  expect(within(second).getByText(/Elements: Water/)).toBeInTheDocument();
  const third = screen.getByText('Taurus text.').closest('li');
  expect(within(third).getByText('Moon in Taurus')).toBeInTheDocument();
  expect(within(third).getByText('Light')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').map(li => li.textContent).join('|')).toMatch(/Waxing text.*Water text.*Taurus text/);
});

it('changes the value choices when the kind changes', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Waxing text.');
  await user.click(screen.getByRole('button', { name: 'Add a rule' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add a timing rule' });
  const value = within(dialog).getByLabelText('Value');
  expect(within(value).getAllByRole('option').map(o => o.textContent)).toEqual(['Waxing', 'Full', 'Waning', 'New']);
  await user.selectOptions(within(dialog).getByLabelText('Kind'), 'moon_sign');
  expect(within(within(dialog).getByLabelText('Value')).getAllByRole('option')).toHaveLength(12);
  await user.selectOptions(within(dialog).getByLabelText('Kind'), 'festival');
  expect(within(within(dialog).getByLabelText('Value')).getAllByRole('option').map(o => o.textContent)).toContain('Samhain');
  expect(within(dialog).getByLabelText('Tincture')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Bath salts')).toBeInTheDocument();
});

it('adds a rule with the right body and counts the text', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Waxing text.');
  await user.click(screen.getByRole('button', { name: 'Add a rule' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add a timing rule' });
  await user.selectOptions(within(dialog).getByLabelText('Kind'), 'moon_sign');
  await user.selectOptions(within(dialog).getByLabelText('Value'), 'Cancer');
  await user.type(within(dialog).getByLabelText('Text'), 'Good for soups');
  expect(within(dialog).getByText('14 of 300')).toBeInTheDocument();
  await user.selectOptions(within(dialog).getByLabelText('Weight'), '3');
  await user.click(within(dialog).getByLabelText('Tea blend'));
  await user.click(within(dialog).getByLabelText('Bath salts'));
  await user.click(within(dialog).getByLabelText('Venus'));
  await user.click(within(dialog).getByLabelText('Water'));
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find(c => c.method === 'POST' && c.url === '/api/timing-rules')).toBeTruthy());
  expect(calls.find(c => c.method === 'POST').body).toEqual({
    kind: 'moon_sign', value: 'Cancer', text: 'Good for soups', weight: 3,
    recipe_types: ['tea-blend', 'bath-salts'], planets: ['Venus'], elements: ['Water'],
  });
});

it('edits a rule with its values filled in', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Water text.');
  await user.click(screen.getByRole('button', { name: 'Edit Moon in a water sign' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit rule' });
  expect(within(dialog).getByLabelText('Kind')).toHaveValue('moon_element');
  expect(within(dialog).getByLabelText('Value')).toHaveValue('Water');
  expect(within(dialog).getByLabelText('Text')).toHaveValue('Water text.');
  expect(within(dialog).getByLabelText('Moon')).toBeChecked();
  await user.clear(within(dialog).getByLabelText('Text'));
  await user.type(within(dialog).getByLabelText('Text'), 'New words');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PATCH')).toBeTruthy());
  const patch = calls.find(c => c.method === 'PATCH');
  expect(patch.url).toBe('/api/timing-rules/2');
  expect(patch.body).toMatchObject({ kind: 'moon_element', value: 'Water', text: 'New words', weight: 3, planets: ['Moon'], elements: ['Water'] });
});

it('shows a server error inside the dialog', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Waxing text.');
  await user.click(screen.getByRole('button', { name: 'Add a rule' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add a timing rule' });
  await user.type(within(dialog).getByLabelText('Text'), 'bad');
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(await within(dialog).findByText('Use 300 characters or fewer')).toBeInTheDocument();
});

it('asks for the text before saving when it is empty', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Waxing text.');
  await user.click(screen.getByRole('button', { name: 'Add a rule' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add a timing rule' });
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(await within(dialog).findByText('Write what the tradition says.')).toBeInTheDocument();
  expect(calls.some(c => c.method === 'POST')).toBe(false);
});

it('deletes with an undo that restores the rule', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Waxing text.');
  await user.click(screen.getByRole('button', { name: 'Delete Waxing moon' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/timing-rules/1')).toBe(true));
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/timing-rules/1/restore')).toBe(true));
});

it('moves a rule down with one call carrying the new order', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByText('Waxing text.');
  await user.click(screen.getByRole('button', { name: 'Move Waxing moon down' }));
  await waitFor(() => expect(calls.find(c => c.method === 'PUT')).toBeTruthy());
  const put = calls.find(c => c.method === 'PUT');
  expect(put.url).toBe('/api/timing-rules/order');
  expect(put.body).toEqual({ ids: [2, 1, 3] });
  expect(calls.some(c => c.method === 'PATCH')).toBe(false);
});
