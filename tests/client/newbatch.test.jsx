import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const recipes = [
  { id: 7, name: 'Calendula oil', yield_amount: 100, yield_unit: 'ml' },
  { id: 8, name: 'Rose salve', yield_amount: null, yield_unit: null },
];
const cand = (id, name, amount, unit, draw) => ({ id, name, amount, unit, expires_on: null, convertible: draw != null, draw });
const planFor = (scale = 1) => ({
  recipe: { id: 7, name: 'Calendula oil', type_id: 2, type_name: 'Infused oil' },
  factor: scale,
  start_date: '2026-10-09',
  name: 'Calendula oil, October 9',
  lines: [
    {
      herb_id: 3, name: 'Calendula', amount: 30 * scale, unit: 'g',
      candidates: [cand(11, 'Calendula (dried flower)', 40, 'g', 30 * scale), cand(12, 'Calendula petals', 2, 'oz', 1.06 * scale), cand(13, 'Calendula tincture', 50, 'ml', null)],
      suggested_item_id: 11, suggested_draw: 30 * scale, flag: null,
    },
    { herb_id: null, name: 'Beeswax', amount: 10, unit: 'g', candidates: [], suggested_item_id: null, suggested_draw: null, flag: 'no_jar' },
    { herb_id: null, name: 'Olive oil', amount: 2, unit: 'tbsp', candidates: [cand(14, 'Olive oil', 500, 'g', null)], suggested_item_id: 14, suggested_draw: null, flag: 'no_conversion' },
    { herb_id: 5, name: 'Rose', amount: 20, unit: 'g', candidates: [cand(15, 'Rose', 5, 'g', 20)], suggested_item_id: 15, suggested_draw: 20, flag: 'not_enough' },
    { herb_id: 6, name: 'Sage', amount: null, unit: null, candidates: [cand(16, 'Sage', 9, 'g', null)], suggested_item_id: 16, suggested_draw: null, flag: 'no_amount' },
  ],
  steps: [{ title: 'Strain and bottle', due_on: '2026-10-30' }],
  prefill: { intention: 'Soothe the skin', method: 'Warm the oil.', base: 'Beeswax, Olive oil', label_notes: 'Keeps about 3 months.' },
});
const items = [
  { id: 21, name: 'Lavender', amount: 25, unit: 'g' },
  { id: 22, name: 'Almond oil', amount: 200, unit: 'ml' },
];

let calls;
let shortOnce;
let planFail;
let scaleBad;
let holdPlan;
beforeEach(() => {
  calls = [];
  shortOnce = false;
  planFail = false;
  scaleBad = false;
  holdPlan = null;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/recipes') return json(recipes);
    if (url.startsWith('/api/items')) return json(items);
    if (url === '/api/batches/plan') {
      if (planFail) return json({ error: 'That recipe is not in the book.' }, 404);
      if (scaleBad && body.scale === 99) return json({ error: 'Fix the scale.', details: { scale: 'That is too large.' } }, 400);
      if (holdPlan && body.scale === holdPlan.scale) await holdPlan.promise;
      return json(planFor(body.scale ?? 1));
    }
    if (url === '/api/batches' && method === 'POST') {
      if (shortOnce && !body.confirm_short) {
        return json({ error: 'Some jars hold less than you are drawing.', details: { short: [{ line: 3, item_id: 15, name: 'Rose', has: 5, wants: 20, unit: 'g' }] } }, 409);
      }
      return json({ id: 42 }, 201);
    }
    return json({});
  });
});

const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const plans = () => calls.filter(c => c.url === '/api/batches/plan');
const posts = () => calls.filter(c => c.method === 'POST' && c.url === '/api/batches');
const group = name => screen.findByRole('group', { name });
const ready = async () => { await screen.findByRole('group', { name: '30 g Calendula' }); };

it('plans from the recipe in the link and prefills the journal fields', async () => {
  open('/batches/new?recipe=7');
  await ready();
  expect(plans()[0].body).toMatchObject({ recipe_id: 7 });
  expect(screen.getByLabelText('Recipe')).toHaveValue('7');
  expect(screen.getByLabelText('Name')).toHaveValue('Calendula oil, October 9');
  expect(screen.getByLabelText('Why I made it')).toHaveValue('Soothe the skin');
  expect(screen.getByLabelText("How I'm preparing it")).toHaveValue('Warm the oil.');
  expect(screen.getByLabelText('Base')).toHaveValue('Beeswax, Olive oil');
  expect(screen.getByLabelText('Label and shelf-life notes')).toHaveValue('Keeps about 3 months.');
  expect(screen.getByLabelText('Step 1 title')).toHaveValue('Strain and bottle');
  expect(screen.getByLabelText('Step 1 due date')).toHaveValue('2026-10-30');
});

it('carries the scale from the link and re-plans when it changes', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7&scale=2');
  await screen.findByRole('group', { name: '60 g Calendula' });
  expect(plans()[0].body).toMatchObject({ recipe_id: 7, scale: 2 });
  expect(screen.getByLabelText('Make')).toHaveValue('2');
  await user.selectOptions(screen.getByLabelText('Make'), '3');
  await screen.findByRole('group', { name: '90 g Calendula' });
  expect(plans().at(-1).body).toMatchObject({ recipe_id: 7, scale: 3 });
});

it('re-plans when the recipe changes and when the start date changes', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7');
  await ready();
  const n = plans().length;
  await user.selectOptions(screen.getByLabelText('Recipe'), '8');
  await waitFor(() => expect(plans().length).toBe(n + 1));
  expect(plans().at(-1).body.recipe_id).toBe(8);
  const date = screen.getByLabelText('Start date');
  await user.clear(date);
  await user.type(date, '2026-11-01');
  await waitFor(() => expect(plans().at(-1).body.start_date).toBe('2026-11-01'));
});

it('forgets the scale and yield when another recipe is picked', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7&scale=2');
  await screen.findByRole('group', { name: '60 g Calendula' });
  const n = plans().length;
  await user.selectOptions(screen.getByLabelText('Recipe'), '8');
  await waitFor(() => expect(plans().length).toBe(n + 1));
  expect(plans().at(-1).body).toEqual({ recipe_id: 8, start_date: expect.any(String) });
  expect(screen.getByLabelText('Make')).toHaveValue('1');
  expect(screen.getByRole('option', { name: 'As written' }).selected).toBe(true);
});

it('shows a scale error with Reset instead of waiting for jars', async () => {
  scaleBad = true;
  open('/batches/new?recipe=7&scale=99');
  expect(await screen.findByText('That is too large.')).toBeInTheDocument();
  expect(screen.queryByText('Working out the jars…')).toBeNull();
  expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Ingredients and jars' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Journal' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Start batch' })).toBeDisabled();
});

it('shows a draw row per ingredient with the flag notes', async () => {
  open('/batches/new?recipe=7');
  await ready();
  const cal = await group('30 g Calendula');
  expect(within(cal).getByLabelText('From jar')).toHaveValue('11');
  expect(within(cal).getByLabelText('Amount to draw (g)')).toHaveValue(30);
  expect(within(cal).getByRole('option', { name: 'Calendula (dried flower), 40 g left' })).toBeInTheDocument();
  expect(within(cal).getByRole('option', { name: "Don't draw from a jar" })).toBeInTheDocument();
  const wax = await group('10 g Beeswax');
  expect(within(wax).getByText('No jar in the cabinet matches. You can still make it.')).toBeInTheDocument();
  const oil = await group('2 tbsp Olive oil');
  expect(within(oil).getByText("Can't convert tbsp to g. Enter the amount to draw by hand.")).toBeInTheDocument();
  expect(within(oil).getByLabelText('Amount to draw (g)')).toHaveValue(null);
  const rose = await group('20 g Rose');
  expect(within(rose).getByText('This jar holds only 5 g.')).toBeInTheDocument();
  const sage = await group('Sage');
  expect(within(sage).getByText('No amount in the recipe.')).toBeInTheDocument();
});

it('recalculates the draw when the jar offers a conversion, and clears it when not', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7');
  await ready();
  const cal = await group('30 g Calendula');
  await user.selectOptions(within(cal).getByLabelText('From jar'), '12');
  expect(within(cal).getByLabelText('Amount to draw (oz)')).toHaveValue(1.06);
  await user.selectOptions(within(cal).getByLabelText('From jar'), '13');
  expect(within(cal).getByLabelText('Amount to draw (ml)')).toHaveValue(null);
  expect(within(cal).getByText("Can't convert g to ml. Enter the amount to draw by hand.")).toBeInTheDocument();
  await user.selectOptions(within(cal).getByLabelText('From jar'), '');
  expect(within(cal).getByLabelText('Amount to draw')).toBeDisabled();
});

it('builds a free-form batch with its own ingredient rows', async () => {
  const user = userEvent.setup();
  open('/batches/new');
  await screen.findByRole('button', { name: 'Add an ingredient' });
  expect(plans()).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
  const row = await group('Ingredient 1');
  await user.type(within(row).getByLabelText('Ingredient name'), 'Lavender buds');
  await user.type(within(row).getByLabelText('Amount'), '15');
  await user.selectOptions(within(row).getByLabelText('Unit'), 'g');
  await user.selectOptions(within(row).getByLabelText('From jar'), '21');
  expect(within(row).getByLabelText('Amount to draw (g)')).toHaveValue(15);
  await user.clear(within(row).getByLabelText('Amount to draw (g)'));
  await user.type(within(row).getByLabelText('Amount to draw (g)'), '12');
  expect(within(row).getByLabelText('Amount to draw (g)')).toHaveValue(12);
  await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
  expect(screen.queryByRole('group', { name: 'Ingredient 1' })).not.toBeInTheDocument();
});

it('edits, adds and removes steps', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7');
  await ready();
  await user.clear(screen.getByLabelText('Step 1 title'));
  await user.type(screen.getByLabelText('Step 1 title'), 'Strain it');
  await user.click(screen.getByRole('button', { name: 'Add a step' }));
  await user.type(screen.getByLabelText('Step 2 title'), 'Label it');
  await user.type(screen.getByLabelText('Step 2 due date'), '2026-11-05');
  await user.click(screen.getByRole('button', { name: 'Remove step 1' }));
  expect(screen.getByLabelText('Step 1 title')).toHaveValue('Label it');
  expect(screen.getByLabelText('Step 1 due date')).toHaveValue('2026-11-05');
  expect(screen.queryByLabelText('Step 2 title')).not.toBeInTheDocument();
});

it('saves with the right body and goes to the batch', async () => {
  const user = userEvent.setup();
  const router = open('/batches/new?recipe=7');
  await ready();
  await user.type(screen.getByLabelText('Notes'), 'Used fresh petals');
  await user.click(screen.getByRole('button', { name: 'Start batch' }));
  await waitFor(() => expect(posts()).toHaveLength(1));
  const b = posts()[0].body;
  expect(b).toMatchObject({
    name: 'Calendula oil, October 9', recipe_id: 7, start_date: '2026-10-09', factor: 1, intention: 'Soothe the skin',
    method: 'Warm the oil.', base: 'Beeswax, Olive oil', label_notes: 'Keeps about 3 months.', notes: 'Used fresh petals',
    steps: [{ title: 'Strain and bottle', due_on: '2026-10-30' }],
  });
  expect(b.confirm_short).toBeUndefined();
  expect(b.lines).toHaveLength(5);
  expect(b.lines[0]).toEqual({ herb_id: 3, name: 'Calendula', amount: 30, unit: 'g', item_id: 11, drawn_amount: 30 });
  expect(b.lines[1]).toEqual({ herb_id: null, name: 'Beeswax', amount: 10, unit: 'g', item_id: null, drawn_amount: null });
  expect(b.lines[2]).toMatchObject({ item_id: 14, drawn_amount: null });
  expect(b.lines[4]).toMatchObject({ name: 'Sage', amount: null, unit: null });
  await waitFor(() => expect(router.state.location.pathname).toBe('/batches/42'));
});

it('saves a free-form batch without a recipe', async () => {
  const user = userEvent.setup();
  open('/batches/new');
  await screen.findByRole('button', { name: 'Add an ingredient' });
  await user.type(screen.getByLabelText('Name'), 'Mystery balm');
  await user.click(screen.getByRole('button', { name: 'Add an ingredient' }));
  const row = await group('Ingredient 1');
  await user.type(within(row).getByLabelText('Ingredient name'), 'Lavender');
  await user.selectOptions(within(row).getByLabelText('From jar'), '21');
  await user.type(within(row).getByLabelText('Amount to draw (g)'), '5');
  await user.click(screen.getByRole('button', { name: 'Start batch' }));
  await waitFor(() => expect(posts()).toHaveLength(1));
  const b = posts()[0].body;
  expect(b.recipe_id).toBeNull();
  expect(b.name).toBe('Mystery balm');
  expect(b.factor).toBeUndefined();
  expect(b.lines).toEqual([{ herb_id: null, name: 'Lavender', amount: null, unit: null, item_id: 21, drawn_amount: 5 }]);
});

it('asks before drawing more than a jar holds, then re-posts with confirm_short', async () => {
  const user = userEvent.setup();
  shortOnce = true;
  const router = open('/batches/new?recipe=7');
  await ready();
  await user.click(screen.getByRole('button', { name: 'Start batch' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Rose: has 5 g, drawing 20 g')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Go back' }));
  expect(posts()).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Start batch' }));
  await user.click(await screen.findByRole('button', { name: "Use what's there (set to 0)" }));
  await waitFor(() => expect(posts()).toHaveLength(3));
  expect(posts()[2].body.confirm_short).toBe(true);
  await waitFor(() => expect(router.state.location.pathname).toBe('/batches/42'));
});

it('does not double submit', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7');
  await ready();
  await user.dblClick(screen.getByRole('button', { name: 'Start batch' }));
  await waitFor(() => expect(posts().length).toBeGreaterThan(0));
  expect(posts()).toHaveLength(1);
});

it('shows server errors by the field', async () => {
  const user = userEvent.setup();
  const base = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) => (url === '/api/batches' && opts.method === 'POST'
    ? new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { name: 'Add a name', 'steps.0.title': 'Add a title' } }), { status: 400 })
    : base(url, opts)));
  open('/batches/new?recipe=7');
  await ready();
  await user.click(screen.getByRole('button', { name: 'Start batch' }));
  expect(await screen.findByText('Add a name')).toBeInTheDocument();
  expect(screen.getByText('Add a title')).toBeInTheDocument();
});

it('asks before leaving a changed form', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7');
  await ready();
  await user.type(screen.getByLabelText('Notes'), 'x');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
});

it('leaves an untouched form without asking', async () => {
  const user = userEvent.setup();
  const router = open('/batches/new?recipe=7');
  await ready();
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/batches'));
});

it('shows a load error with Try again', async () => {
  const user = userEvent.setup();
  planFail = true;
  open('/batches/new?recipe=7');
  expect(await screen.findByRole('alert')).toHaveTextContent('That recipe is not in the book.');
  planFail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await ready();
});

// Greptile round 1 -------------------------------------------------------------

it('cannot start a batch from an old plan while a new plan is on its way', async () => {
  const user = userEvent.setup();
  let release;
  holdPlan = { scale: 3, promise: new Promise(r => { release = r; }) };
  open('/batches/new?recipe=7');
  await ready();
  await user.selectOptions(screen.getByLabelText('Make'), '3');
  await waitFor(() => expect(plans().at(-1).body.scale).toBe(3));
  const start = screen.getByRole('button', { name: 'Start batch' });
  expect(start).toBeDisabled();
  fireEvent.submit(start.closest('form'));
  await new Promise(r => setTimeout(r, 50));
  expect(posts()).toHaveLength(0);
  release();
  await screen.findByRole('group', { name: '90 g Calendula' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start batch' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Start batch' }));
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(posts()[0].body.factor).toBe(3);
});

it('cannot start a batch from an old plan after the new scale fails', async () => {
  const user = userEvent.setup();
  scaleBad = true;
  open('/batches/new?recipe=7');
  await ready();
  await user.selectOptions(screen.getByLabelText('Make'), 'other');
  await user.type(await screen.findByLabelText('Factor'), '99');
  expect(await screen.findByText('That is too large.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start batch' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Start batch' }).closest('form'));
  await new Promise(r => setTimeout(r, 50));
  expect(posts()).toHaveLength(0);
});

it('asks for a start date when it is cleared, and does not save the old one', async () => {
  const user = userEvent.setup();
  open('/batches/new?recipe=7');
  await ready();
  const n = plans().length;
  await user.clear(screen.getByLabelText('Start date'));
  expect(await screen.findByText('Pick a start date')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start batch' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('button', { name: 'Start batch' }).closest('form'));
  await new Promise(r => setTimeout(r, 400));
  expect(posts()).toHaveLength(0);
  expect(plans()).toHaveLength(n);
  await user.type(screen.getByLabelText('Start date'), '2026-11-01');
  await waitFor(() => expect(plans().at(-1).body.start_date).toBe('2026-11-01'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start batch' })).toBeEnabled());
  expect(screen.queryByText('Pick a start date')).toBeNull();
});

it('asks for a start date on a free-form batch too', async () => {
  const user = userEvent.setup();
  open('/batches/new');
  await screen.findByLabelText('Recipe');
  await user.clear(screen.getByLabelText('Start date'));
  expect(await screen.findByText('Pick a start date')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start batch' })).toBeDisabled();
});

it('prefills long converted draws to four significant figures', async () => {
  const user = userEvent.setup();
  const orig = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (url === '/api/batches/plan') {
      const p = planFor(1);
      p.lines[0].suggested_draw = 2.000035;
      p.lines[0].candidates[1].draw = 29.5736;
      p.lines[3].suggested_draw = 0.004;
      return new Response(JSON.stringify(p), { status: 200 });
    }
    return orig(url, opts);
  });
  open('/batches/new?recipe=7');
  const g1 = await screen.findByRole('group', { name: '30 g Calendula' });
  expect(within(g1).getByLabelText(/Amount to draw/)).toHaveValue(2);
  await user.selectOptions(within(g1).getByRole('combobox'), '12');
  expect(within(g1).getByLabelText(/Amount to draw/)).toHaveValue(29.57);
  const g4 = screen.getByRole('group', { name: '20 g Rose' });
  expect(within(g4).getByLabelText(/Amount to draw/)).toHaveValue(0.004);
});
