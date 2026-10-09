import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const types = [
  { id: 1, name: 'Tea blend', wait_days: 0, shelf_life_days: 365 },
  { id: 2, name: 'Tincture', wait_days: 42, shelf_life_days: 730 },
  { id: 3, name: 'Salve', wait_days: null, shelf_life_days: 90 },
];
const herbs = [{ id: 3, common_name: 'Calendula' }, { id: 4, common_name: 'Yarrow' }];
const recipe = (id, name, extra = {}) => ({
  id, name, type_id: 2, yield_amount: 100, yield_unit: 'ml', steps: 'Warm the oil.', wait_days: null, shelf_life_days: null,
  intention: 'Soothing', timing_notes: null, notes: null,
  ingredients: [
    { id: 1, herb_id: 3, name: 'Calendula', amount: 30, unit: 'g', form: 'dried leaf', plant_part: 'flower', note: 'packed' },
    { id: 2, herb_id: null, name: 'Beeswax', amount: null, unit: null, form: null, plant_part: null, note: null },
  ],
  ...extra,
});

let calls;
let fail;
let loadFail;
beforeEach(() => {
  calls = [];
  fail = null;
  loadFail = false;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (method !== 'GET' && fail) return json({ error: 'Please fix the highlighted fields.', details: fail }, 400);
    if (url === '/api/recipes' && method === 'POST') return json({ id: 9 }, 201);
    if (url === '/api/recipes/7' && method === 'PATCH') return json({ id: 7 });
    if (url === '/api/recipe-types') return loadFail ? json({ error: 'Could not load types' }, 500) : json(types);
    if (url === '/api/herbs') return json(herbs);
    if (url === '/api/recipes/7') return json(recipe(7, 'Calendula salve'));
    if (url === '/api/recipes/8') return json(recipe(8, 'Yarrow tea', { ingredients: [] }));
    if (url === '/api/recipes/9') return json(recipe(9, 'New'));
    return json({});
  });
});

const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const sent = () => calls.find(c => c.method !== 'GET')?.body;
const nameField = () => screen.findByLabelText('Name (required)');

it('marks name and type required and shows server errors on them', async () => {
  const user = userEvent.setup();
  open('/recipes/new');
  expect(await nameField()).toBeRequired();
  expect(screen.getByLabelText('Type (required)')).toBeRequired();
  fail = { name: 'Required', type_id: 'Pick a type' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Required')).toBeInTheDocument();
  expect(screen.getByLabelText('Type (required)')).toHaveAccessibleDescription('Pick a type');
});

it('shows the type defaults in the wait and shelf life hints', async () => {
  const user = userEvent.setup();
  open('/recipes/new');
  await nameField();
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Tincture');
  expect(screen.getByLabelText('Wait in days')).toHaveAccessibleDescription("Leave blank to use the type's 6 weeks");
  expect(screen.getByLabelText('Shelf life in days')).toHaveAccessibleDescription("Leave blank to use the type's 2 years");
});

it('fills the name from a picked herb only when the name is empty', async () => {
  const user = userEvent.setup();
  open('/recipes/new');
  await nameField();
  await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
  await user.selectOptions(screen.getByLabelText('Ingredient 1 grimoire herb'), 'Calendula');
  expect(screen.getByLabelText('Ingredient 1 name')).toHaveValue('Calendula');
  await user.selectOptions(screen.getByLabelText('Ingredient 1 grimoire herb'), 'Yarrow');
  expect(screen.getByLabelText('Ingredient 1 name')).toHaveValue('Calendula');
});

it('adds, removes and reorders ingredients and sends them in order with numbers and nulls', async () => {
  const user = userEvent.setup();
  open('/recipes/7/edit');
  await waitFor(() => expect(screen.getByLabelText('Name (required)')).toHaveValue('Calendula salve'));
  await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
  expect(screen.getByLabelText('Ingredient 3 name')).toHaveFocus();
  await user.type(screen.getByLabelText('Ingredient 3 name'), 'Olive oil');
  await user.type(screen.getByLabelText('Ingredient 3 amount'), '250');
  await user.selectOptions(screen.getByLabelText('Ingredient 3 unit'), 'ml');
  await user.click(screen.getByRole('button', { name: 'Move ingredient 2 up' }));
  await user.click(screen.getByRole('button', { name: 'Remove ingredient 3' }));
  await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
  await user.type(screen.getByLabelText('Ingredient 3 name'), 'Lavender');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sent()).toBeTruthy());
  const body = sent();
  expect(body.ingredients.map(i => i.name)).toEqual(['Beeswax', 'Calendula', 'Lavender']);
  expect(body.ingredients[0]).toMatchObject({ herb_id: null, amount: null, unit: null, form: null, plant_part: null, note: null });
  expect(body.ingredients[1]).toMatchObject({ herb_id: 3, amount: 30, unit: 'g', form: 'dried leaf', plant_part: 'flower', note: 'packed' });
  expect(body).toMatchObject({ name: 'Calendula salve', type_id: 2, yield_amount: 100, yield_unit: 'ml', wait_days: null, steps: 'Warm the oil.' });
});

it('sends a blank amount as null', async () => {
  const user = userEvent.setup();
  open('/recipes/new');
  await user.type(await nameField(), 'Tea');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Tea blend');
  await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
  await user.type(screen.getByLabelText('Ingredient 1 name'), 'Mint');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sent()).toBeTruthy());
  expect(sent().ingredients[0].amount).toBeNull();
  expect(sent().type_id).toBe(1);
});

it('goes to the recipe page with a Saved toast', async () => {
  const user = userEvent.setup();
  const router = open('/recipes/new');
  await user.type(await nameField(), 'Tea');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/9'));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

it('shows a row error on its row and clears every ingredient error when the list changes', async () => {
  const user = userEvent.setup();
  open('/recipes/7/edit');
  await waitFor(() => expect(screen.getByLabelText('Name (required)')).toHaveValue('Calendula salve'));
  fail = { 'ingredients.1.name': 'Add a name or pick a herb', 'ingredients.0.amount': 'Must be 0 or more', ingredients: 'Use at most 80 ingredients' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const err = await screen.findByText('Add a name or pick a herb');
  expect(err.closest('fieldset')).toHaveTextContent('Ingredient 2');
  expect(screen.getByText('Must be 0 or more').closest('fieldset')).toHaveTextContent('Ingredient 1');
  expect(screen.getByText('Use at most 80 ingredients')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
  expect(screen.queryByText('Add a name or pick a herb')).not.toBeInTheDocument();
  expect(screen.queryByText('Must be 0 or more')).not.toBeInTheDocument();
  expect(screen.queryByText('Use at most 80 ingredients')).not.toBeInTheDocument();
});

it('preselects the type from ?type=', async () => {
  open('/recipes/new?type=3');
  await nameField();
  expect(screen.getByLabelText('Type (required)')).toHaveValue('3');
});

it('starts with the herb from ?herb= as the first ingredient', async () => {
  open('/recipes/new?herb=4');
  await nameField();
  expect(screen.getByLabelText('Ingredient 1 grimoire herb')).toHaveValue('4');
  expect(screen.getByLabelText('Ingredient 1 name')).toHaveValue('Yarrow');
  expect(screen.queryByLabelText('Ingredient 2 name')).not.toBeInTheDocument();
});

it('ignores a ?type= that does not exist', async () => {
  open('/recipes/new?type=99');
  await nameField();
  expect(screen.getByLabelText('Type (required)')).toHaveValue('');
});

it('sends one POST when Save is pressed twice quickly', async () => {
  const user = userEvent.setup();
  open('/recipes/new');
  await user.type(await nameField(), 'Sage tea');
  await user.dblClick(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST')).toBe(true));
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
});

it('asks before leaving a changed form', async () => {
  const user = userEvent.setup();
  open('/recipes/new');
  await user.type(await nameField(), 'x');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
});

it('leaves an untouched form without asking', async () => {
  const user = userEvent.setup();
  const router = open('/recipes/new');
  await nameField();
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
});

it('re-seeds the form when the id changes', async () => {
  const router = open('/recipes/7/edit');
  await waitFor(() => expect(screen.getByLabelText('Name (required)')).toHaveValue('Calendula salve'));
  expect(screen.getByLabelText('Ingredient 2 name')).toHaveValue('Beeswax');
  await act(() => router.navigate('/recipes/8/edit'));
  await waitFor(() => expect(screen.getByLabelText('Name (required)')).toHaveValue('Yarrow tea'));
  expect(screen.queryByLabelText('Ingredient 1 name')).not.toBeInTheDocument();
});

it('shows an error with Try again when the types fail to load', async () => {
  const user = userEvent.setup();
  loadFail = true;
  open('/recipes/new');
  expect(await screen.findByText('Could not load types')).toBeInTheDocument();
  expect(screen.queryByLabelText('Name (required)')).not.toBeInTheDocument();
  loadFail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await nameField()).toBeInTheDocument();
});

it('groups each ingredient in a fieldset named Ingredient N', async () => {
  open('/recipes/7/edit');
  await waitFor(() => expect(screen.getByLabelText('Name (required)')).toHaveValue('Calendula salve'));
  const group = screen.getByRole('group', { name: 'Ingredient 2' });
  expect(within(group).getByLabelText('Ingredient 2 amount')).toBeInTheDocument();
});
