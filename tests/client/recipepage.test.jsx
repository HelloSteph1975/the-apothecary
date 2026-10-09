import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const base = {
  id: 7, name: 'Calendula salve', type_id: 2, yield_amount: 100, yield_unit: 'ml',
  steps: 'Warm the oil.\n\n  \nStir in the wax.', wait_days: null, shelf_life_days: null,
  intention: 'Soothing', timing_notes: 'Start at the new moon', notes: 'Use a small tin.',
  type: { id: 2, name: 'Salve', is_topical: 1, label_caution: 'Keep away from eyes.' },
  effective_wait_days: 14, effective_shelf_life_days: 365, factor: 1, scaled_yield_amount: 100,
  ingredients: [
    { id: 1, herb_id: 3, herb_name: 'Calendula', herb_deleted: false, name: 'Calendula-infused olive oil', amount: 30, base_amount: 30, unit: 'g', form: 'dried', plant_part: 'flower', note: 'packed' },
    { id: 2, herb_id: 4, herb_name: null, herb_deleted: true, name: 'Old comfrey', amount: 10, base_amount: 10, unit: 'g', form: null, plant_part: null, note: null },
    { id: 3, herb_id: null, herb_name: null, herb_deleted: false, name: 'Beeswax', amount: null, base_amount: null, unit: null, form: null, plant_part: null, note: null },
  ],
  cautions: [{ herb_id: 3, common_name: 'Calendula', items: [{ field: 'caution_pregnancy', text: 'Skip if allergic to daisies.' }] }],
  label_caution: 'Keep away from eyes.', needs_patch_test: true, photos: [],
};

let recipe;
let calls;
beforeEach(() => {
  calls = [];
  recipe = base;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/recipes/7' && method === 'DELETE') return json({ ok: true, restore: '/api/recipes/7/restore' });
    if (method === 'GET' && url.startsWith('/api/recipes/7')) {
      const q = new URLSearchParams(url.split('?')[1] ?? '');
      if (q.get('scale') === '500') return json({ error: 'Check the form', details: { scale: 'Use a number from 0.01 to 100' } }, 400);
      if (q.get('scale') === '2') {
        return json({ ...recipe, factor: 2, scaled_yield_amount: 200, ingredients: recipe.ingredients.map(i => ({ ...i, amount: i.amount == null ? null : i.amount * 2 })) });
      }
      if (q.get('yield') === '50') return json({ ...recipe, factor: 0.5, scaled_yield_amount: 50 });
      return json(recipe);
    }
    if (/^\/api\/(recipes|recipe-types|herbs)(\?|$)/.test(url)) return json([]);
    return json({});
  });
});

const open = (path = '/recipes/7') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};

it('puts the caution panel before the ingredients, grouped by herb with links', async () => {
  open();
  const panel = await screen.findByRole('region', { name: 'Before you make it' });
  expect(within(panel).getByText('Keep away from eyes.')).toBeInTheDocument();
  expect(within(panel).getByRole('link', { name: 'Calendula' })).toHaveAttribute('href', '/grimoire/3');
  expect(within(panel).getByText('Pregnancy and nursing')).toBeInTheDocument();
  expect(within(panel).getByText('Skip if allergic to daisies.')).toBeInTheDocument();
  expect(within(panel).getByText(/Not medical advice/)).toBeInTheDocument();
  const ingredients = screen.getByRole('region', { name: 'Ingredients' });
  expect(panel.compareDocumentPosition(ingredients) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1, name: 'Calendula salve' })).toBeInTheDocument();
  expect(screen.getByText('Salve, makes 100 ml')).toBeInTheDocument();
});

it('shows the patch test line for topical types', async () => {
  open();
  const panel = await screen.findByRole('region', { name: 'Before you make it' });
  expect(within(panel).getByText(/Patch test first: dab a little/)).toBeInTheDocument();
});

it('hides the patch test line for other types and says so when there are no cautions', async () => {
  recipe = {
    ...base, needs_patch_test: false, label_caution: null, cautions: [], type: { ...base.type, is_topical: 0, label_caution: null },
    ingredients: base.ingredients.filter(i => !i.herb_deleted),
  };
  open();
  const panel = await screen.findByRole('region', { name: 'Before you make it' });
  expect(within(panel).queryByText(/Patch test first/)).not.toBeInTheDocument();
  expect(within(panel).getByText('No cautions recorded for these ingredients. Check each herb before you make it.')).toBeInTheDocument();
});

it('says when a linked herb is gone from the grimoire, so its cautions are missing', async () => {
  open();
  const panel = await screen.findByRole('region', { name: 'Before you make it' });
  expect(within(panel).getByText("Old comfrey is no longer in the grimoire, so its cautions can't be shown here.")).toBeInTheDocument();
});

it('does not claim there are no cautions when a linked herb is gone', async () => {
  recipe = { ...base, needs_patch_test: false, label_caution: null, cautions: [], type: { ...base.type, is_topical: 0, label_caution: null } };
  open();
  const panel = await screen.findByRole('region', { name: 'Before you make it' });
  expect(within(panel).getByText("Old comfrey is no longer in the grimoire, so its cautions can't be shown here.")).toBeInTheDocument();
  expect(within(panel).queryByText(/No cautions recorded for these ingredients/)).not.toBeInTheDocument();
  expect(within(panel).getByText('No cautions recorded for the other ingredients. Check each herb before you make it.')).toBeInTheDocument();
});

it('scales with ?scale= and shows the scaled amounts', async () => {
  const user = userEvent.setup();
  const router = open();
  await screen.findByRole('region', { name: 'Ingredients' });
  const scalePanel = screen.getByRole('region', { name: 'Scale' });
  expect(within(scalePanel).getByRole('status')).toBeEmptyDOMElement();
  expect(within(screen.getByLabelText('Make')).getAllByRole('option').map(o => o.textContent)).toEqual(['Half', 'As written', 'Double', 'Triple', 'Other']);
  await user.selectOptions(screen.getByLabelText('Make'), 'Double');
  await waitFor(() => expect(within(scalePanel).getByRole('status')).toHaveTextContent('Scaled to 2×: makes 200 ml'), { timeout: 4000 });
  expect(calls.some(c => c.url === '/api/recipes/7?scale=2')).toBe(true);
  expect(screen.getByText('60 g')).toBeInTheDocument();
  expect(router.state.location.search).toBe('?scale=2');
  await user.click(screen.getByRole('button', { name: 'Reset' }));
  await waitFor(() => expect(within(scalePanel).getByRole('status')).toBeEmptyDOMElement());
  expect(router.state.location.search).toBe('');
});

it('keeps the scale from the URL', async () => {
  open('/recipes/7?scale=2');
  expect(await screen.findByText('Scaled to 2×: makes 200 ml', {}, { timeout: 4000 })).toBeInTheDocument();
  expect(screen.getByLabelText('Make')).toHaveValue('2');
});

it('sends ?yield= for a target yield', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('region', { name: 'Ingredients' });
  await user.type(screen.getByLabelText('Or make (ml)'), '50');
  expect(await screen.findByText('Scaled to 0.5×: makes 50 ml', {}, { timeout: 4000 })).toBeInTheDocument();
  expect(calls.some(c => c.url === '/api/recipes/7?yield=50')).toBe(true);
});

it('shows a server error by the field and keeps the page', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('region', { name: 'Ingredients' });
  await user.selectOptions(screen.getByLabelText('Make'), 'other');
  await user.type(screen.getByLabelText('Factor'), '500');
  expect(await screen.findByText('Use a number from 0.01 to 100')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Ingredients' })).toBeInTheDocument();
});

it('lists ingredients, the deleted herb note, and steps as an ordered list', async () => {
  open();
  const ing = await screen.findByRole('region', { name: 'Ingredients' });
  expect(within(ing).getByRole('link', { name: 'Calendula-infused olive oil' })).toHaveAttribute('href', '/grimoire/3');
  expect(within(ing).queryByText('Calendula')).not.toBeInTheDocument();
  expect(within(ing).getByText('30 g')).toBeInTheDocument();
  expect(within(ing).getByText(/dried/)).toBeInTheDocument();
  expect(within(ing).getByText('(no longer in the grimoire)')).toBeInTheDocument();
  expect(within(ing).getByText('Beeswax')).toBeInTheDocument();
  const steps = screen.getByRole('region', { name: 'Steps' });
  const items = within(steps).getAllByRole('listitem');
  expect(items.map(li => li.textContent)).toEqual(['Warm the oil.', 'Stir in the wax.']);
  expect(steps.querySelector('ol')).not.toBeNull();
});

it('shows the about details and hides empty ones', async () => {
  recipe = { ...base, timing_notes: '' };
  open();
  const about = await screen.findByRole('region', { name: 'About' });
  expect(within(about).getByText('2 weeks')).toBeInTheDocument();
  expect(within(about).getByText('1 year')).toBeInTheDocument();
  expect(within(about).getByText('Soothing')).toBeInTheDocument();
  expect(within(about).queryByText('Best timing')).not.toBeInTheDocument();
  expect(within(about).getByText('Use a small tin.')).toBeInTheDocument();
});

it('deletes with undo that returns to the page', async () => {
  const user = userEvent.setup();
  const router = open();
  await screen.findByRole('region', { name: 'Ingredients' });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.filter(c => c.method === 'DELETE').map(c => c.url)).toEqual(['/api/recipes/7']));
  await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/recipes/7/restore')).toBe(true));
  await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/7'));
});

it('drops a bad scale from the link and shows the recipe at 1x', async () => {
  const router = open('/recipes/7?scale=500');
  expect(await screen.findByRole('region', { name: 'Ingredients' }, { timeout: 4000 })).toBeInTheDocument();
  expect(router.state.location.search).toBe('');
  expect(screen.getByText(/scale in that link wasn't valid/)).toBeInTheDocument();
  expect(screen.getByLabelText('Make')).toHaveValue('1');
});

it('shows a load failure with Try again that refetches', async () => {
  const user = userEvent.setup();
  const good = global.fetch;
  let fail = true;
  global.fetch = vi.fn(async (url, opts) => (fail && url.startsWith('/api/recipes/7')
    ? new Response(JSON.stringify({ error: 'Something broke' }), { status: 500 })
    : good(url, opts)));
  open();
  expect(await screen.findByText('Something broke')).toBeInTheDocument();
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'Ingredients' })).toBeInTheDocument();
});
