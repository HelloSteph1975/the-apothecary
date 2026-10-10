import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const pad = n => String(n).padStart(2, '0');
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const TODAY_LONG = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const base = {
  id: 5, name: 'Calendula oil, Oct 1', recipe_id: 7, type_id: 2, start_date: '2026-10-01', factor: 2,
  base: 'Olive oil', intention: 'Soothe dry skin', method: 'Steeped in a warm window.', noticed: null, would_change: null,
  label_notes: 'Keeps 6 months.', notes: null, finished_on: null, yield_amount: null, yield_unit: null, expires_on: null, item_id: null,
  recipe: { id: 7, name: 'Calendula oil' }, type: { id: 2, name: 'Infused oil' },
  lines: [
    { id: 1, herb_id: 3, herb_live: true, name: 'Calendula', amount: 40, unit: 'g', item_id: 11, drawn_amount: 40, drawn_unit: 'g', item: { id: 11, name: 'Calendula jar', live: true } },
    { id: 2, herb_id: null, name: 'Olive oil', amount: 500, unit: 'ml', item_id: null, drawn_amount: null, drawn_unit: null, item: null },
  ],
  steps: [
    { id: 21, batch_id: 5, title: 'Strain and bottle', due_on: '2026-10-05', done_on: null, sort_order: 0 },
    { id: 22, batch_id: 5, title: 'Label it', due_on: null, done_on: '2026-10-02', sort_order: 1 },
  ],
  photos: [], made_item: null, status: 'steeping',
};
const sections = [{ id: 1, name: 'Herbs', kind: 'herb' }, { id: 2, name: 'Made things', kind: 'supply' }, { id: 3, name: 'Tools', kind: 'supply' }];

let batch;
let calls;
let failFinish;
let recipeYield;
let failLoads;
beforeEach(() => {
  calls = [];
  batch = JSON.parse(JSON.stringify(base));
  failFinish = null;
  recipeYield = { scaled_yield_amount: 200, yield_unit: 'ml' };
  failLoads = new Set();
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/batches/5' && method === 'GET') return json(batch);
    if (url === '/api/batches/5' && method === 'PATCH') { batch = { ...batch, ...body }; return json(batch); }
    if (url === '/api/batches/5' && method === 'DELETE') return json({ ok: true, restore: '/api/batches/5/restore' });
    if (url === '/api/batches/5/restore') return json(batch);
    if (url === '/api/batches/5/steps' && method === 'POST') {
      const step = { id: 30, batch_id: 5, due_on: null, done_on: null, sort_order: 2, ...body };
      batch = { ...batch, steps: [...batch.steps, step] };
      return json(step, 201);
    }
    const stepMatch = url.match(/^\/api\/batches\/5\/steps\/(\d+)(\/restore)?$/);
    if (stepMatch) {
      const sid = Number(stepMatch[1]);
      if (stepMatch[2]) return json(batch.steps.find(s => s.id === sid) ?? {});
      if (method === 'PATCH') { batch = { ...batch, steps: batch.steps.map(s => (s.id === sid ? { ...s, ...body } : s)) }; return json({}); }
      if (method === 'DELETE') {
        batch = { ...batch, steps: batch.steps.filter(s => s.id !== sid) };
        return json({ ok: true, restore: `/api/batches/5/steps/${sid}/restore` });
      }
    }
    if (url === '/api/batches/5/finish') {
      if (failFinish) return json(failFinish.body, failFinish.status);
      batch = {
        ...batch, finished_on: body.finished_on, yield_amount: body.yield_amount, yield_unit: body.yield_unit, expires_on: '2027-04-01', status: 'finished',
        item_id: body.add_to_cabinet ? 99 : null, made_item: body.add_to_cabinet ? { id: 99, name: 'Calendula oil, Oct 1' } : null,
      };
      return json(batch);
    }
    if (url === '/api/batches/5/unfinish') {
      batch = { ...batch, finished_on: null, yield_amount: null, yield_unit: null, expires_on: null, item_id: null, made_item: null, status: 'ready' };
      return json(batch);
    }
    if (url === '/api/sections') return failLoads.has('sections') ? json({ error: 'The sections would not load.' }, 500) : json(sections);
    if (url.startsWith('/api/recipes/7')) return failLoads.has('recipe') ? json({ error: 'The recipe would not load.' }, 500) : json({ id: 7, ...recipeYield });
    return json({});
  });
});

const open = (path = '/batches/5') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const sent = (method, url) => calls.filter(c => c.method === method && c.url === url);
const stepsPanel = () => screen.findByRole('region', { name: 'Steps' });

it('shows the name, subtitle and Steeping badge while a step is open', async () => {
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' })).toBeInTheDocument();
  expect(screen.getByText(/Calendula oil \(Infused oil\), started Oct 1, 2026/)).toBeInTheDocument();
  expect(screen.getByText('Steeping')).toBeInTheDocument();
});

it('shows Ready to finish when the server says every step is done', async () => {
  batch.status = 'ready';
  open();
  expect(await screen.findByText('Ready to finish')).toBeInTheDocument();
});

it('shows a Finished badge with the day and the finished panel', async () => {
  batch = { ...batch, status: 'finished', finished_on: '2026-10-08', yield_amount: 200, yield_unit: 'ml', expires_on: '2027-04-08', item_id: 99, made_item: { id: 99, name: 'Calendula oil jar' } };
  open();
  expect(await screen.findByText('Finished Oct 8, 2026')).toBeInTheDocument();
  const panel = screen.getByRole('region', { name: 'Finished' });
  expect(within(panel).getByText('200 ml')).toBeInTheDocument();
  expect(within(panel).getByText('Apr 8, 2027')).toBeInTheDocument();
  expect(within(panel).getByRole('link', { name: 'Calendula oil jar' })).toHaveAttribute('href', '/cabinet/items/99');
  expect(screen.queryByRole('button', { name: 'Finish this batch' })).toBeNull();
});

it('links to the record sheet', async () => {
  open();
  expect(await screen.findByRole('link', { name: 'Print record sheet' })).toHaveAttribute('href', '/batches/5/sheet');
});

it('checks a step done with today and unchecks it to clear the date', async () => {
  open();
  const rows = within(await stepsPanel()).getAllByRole('listitem');
  await userEvent.click(within(rows[0]).getByRole('checkbox', { name: 'Done: Strain and bottle' }));
  await waitFor(() => expect(sent('PATCH', '/api/batches/5/steps/21')).toHaveLength(1));
  expect(sent('PATCH', '/api/batches/5/steps/21')[0].body).toEqual({ done_on: TODAY });
  await waitFor(() => expect(within(within(screen.getByRole('region', { name: 'Steps' })).getAllByRole('listitem')[0]).getByRole('checkbox')).toBeChecked());
  const again = within(screen.getByRole('region', { name: 'Steps' })).getAllByRole('listitem');
  await userEvent.click(within(again[1]).getByRole('checkbox', { name: 'Done: Label it' }));
  await waitFor(() => expect(sent('PATCH', '/api/batches/5/steps/22')).toHaveLength(1));
  expect(sent('PATCH', '/api/batches/5/steps/22')[0].body).toEqual({ done_on: null });
});

it('marks an overdue step', async () => {
  open();
  const rows = within(await stepsPanel()).getAllByRole('listitem');
  expect(within(rows[0]).getByText('Overdue')).toBeInTheDocument();
  expect(within(rows[1]).queryByText('Overdue')).toBeNull();
});

it('adds a step', async () => {
  open();
  const steps = await stepsPanel();
  await userEvent.click(within(steps).getByRole('button', { name: 'Add a step' }));
  await userEvent.type(within(steps).getByLabelText('Step'), 'Rinse the jars');
  await userEvent.type(within(steps).getByLabelText('Due on'), '2026-10-20');
  await userEvent.click(within(steps).getByRole('button', { name: 'Save step' }));
  await waitFor(() => expect(sent('POST', '/api/batches/5/steps')).toHaveLength(1));
  expect(sent('POST', '/api/batches/5/steps')[0].body).toEqual({ title: 'Rinse the jars', due_on: '2026-10-20' });
  expect(await screen.findByText('Rinse the jars')).toBeInTheDocument();
});

it('asks for a step title before adding', async () => {
  open();
  const steps = await stepsPanel();
  await userEvent.click(within(steps).getByRole('button', { name: 'Add a step' }));
  await userEvent.click(within(steps).getByRole('button', { name: 'Save step' }));
  expect(await within(steps).findByText('Give this step a name.')).toBeInTheDocument();
  expect(sent('POST', '/api/batches/5/steps')).toHaveLength(0);
});

it('edits a step', async () => {
  open();
  const steps = await stepsPanel();
  await userEvent.click(within(steps).getByRole('button', { name: 'Edit Strain and bottle' }));
  const title = within(steps).getByLabelText('Step');
  await userEvent.clear(title);
  await userEvent.type(title, 'Strain it twice');
  await userEvent.click(within(steps).getByRole('button', { name: 'Save step' }));
  await waitFor(() => expect(sent('PATCH', '/api/batches/5/steps/21')).toHaveLength(1));
  expect(sent('PATCH', '/api/batches/5/steps/21')[0].body).toEqual({ title: 'Strain it twice', due_on: '2026-10-05' });
  expect(await screen.findByText('Strain it twice')).toBeInTheDocument();
});

it('deletes a step and can undo it', async () => {
  open();
  const steps = await stepsPanel();
  await userEvent.click(within(steps).getByRole('button', { name: 'Delete Label it' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(sent('DELETE', '/api/batches/5/steps/22')).toHaveLength(1));
  await waitFor(() => expect(screen.queryByText('Label it')).toBeNull());
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(sent('POST', '/api/batches/5/steps/22/restore')).toHaveLength(1));
});

it('lists what went in with herb and jar links', async () => {
  open();
  const panel = await screen.findByRole('region', { name: 'What went in' });
  const rows = within(panel).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('40 g Calendula, from Calendula jar (40 g)');
  expect(within(rows[0]).getByRole('link', { name: 'Calendula' })).toHaveAttribute('href', '/grimoire/3');
  expect(within(rows[0]).getByRole('link', { name: 'Calendula jar' })).toHaveAttribute('href', '/cabinet/items/11');
  expect(rows[1]).toHaveTextContent('500 ml Olive oil, not drawn from a jar');
});

it('edits the journal in place and saves it', async () => {
  open();
  await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  const journal = screen.getByRole('region', { name: 'Journal' });
  expect(within(journal).getByText('Soothe dry skin')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.type(within(journal).getByLabelText('What I noticed'), 'Smells sunny');
  await userEvent.click(within(journal).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sent('PATCH', '/api/batches/5')).toHaveLength(1));
  expect(sent('PATCH', '/api/batches/5')[0].body).toEqual({
    intention: 'Soothe dry skin', method: 'Steeped in a warm window.', base: 'Olive oil', noticed: 'Smells sunny', would_change: null,
    label_notes: 'Keeps 6 months.', notes: null,
  });
  expect(await within(journal).findByText('Smells sunny')).toBeInTheDocument();
  expect(within(journal).queryByLabelText('What I noticed')).toBeNull();
});

it('cancels a journal edit without saving', async () => {
  open();
  await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  const journal = screen.getByRole('region', { name: 'Journal' });
  await userEvent.click(within(journal).getByRole('button', { name: 'Cancel' }));
  expect(within(journal).queryByLabelText('What I noticed')).toBeNull();
  expect(sent('PATCH', '/api/batches/5')).toHaveLength(0);
});

it('warns that drawn amounts stay drawn before deleting a batch', async () => {
  const router = open();
  await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Delete this batch? The amounts drawn from your jars stay drawn.')).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(sent('DELETE', '/api/batches/5')).toHaveLength(1));
  await waitFor(() => expect(router.state.location.pathname).toBe('/batches'));
});

const openFinish = async () => {
  open();
  await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  await userEvent.click(screen.getByRole('button', { name: 'Finish this batch' }));
  return screen.findByRole('dialog');
};

it('prefills the finish dialog from the scaled recipe yield and the cabinet defaults', async () => {
  const dialog = await openFinish();
  expect(within(dialog).getByLabelText('Finished on')).toHaveValue(TODAY);
  await waitFor(() => expect(within(dialog).getByLabelText('Yield amount')).toHaveValue(200));
  expect(within(dialog).getByLabelText('Yield unit')).toHaveValue('ml');
  expect(within(dialog).getByLabelText('Use by')).toHaveValue('');
  expect(within(dialog).getByRole('checkbox', { name: 'Add it to the cabinet as a new jar' })).toBeChecked();
  expect(within(dialog).getByLabelText('Section')).toHaveValue('2');
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Calendula oil, Oct 1');
  expect(within(dialog).getByLabelText('Amount')).toHaveValue(200);
  expect(within(dialog).getByLabelText('Unit')).toHaveValue('ml');
  expect(calls.some(c => c.url === '/api/recipes/7?scale=2')).toBe(true);
});

it('posts the finish with the jar details', async () => {
  const dialog = await openFinish();
  await userEvent.type(within(dialog).getByLabelText('Storage spot'), 'Top shelf');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Finish' }));
  await waitFor(() => expect(sent('POST', '/api/batches/5/finish')).toHaveLength(1));
  expect(sent('POST', '/api/batches/5/finish')[0].body).toEqual({
    finished_on: TODAY, yield_amount: 200, yield_unit: 'ml',
    add_to_cabinet: { section_id: 2, name: 'Calendula oil, Oct 1', amount: 200, unit: 'ml', storage_spot: 'Top shelf' },
  });
  expect(await screen.findByText(`Finished ${TODAY_LONG}`)).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Finished' })).toBeInTheDocument();
});

it('sends no jar when the cabinet box is unchecked, and a use by date when typed', async () => {
  const dialog = await openFinish();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Add it to the cabinet as a new jar' }));
  expect(within(dialog).queryByLabelText('Section')).toBeNull();
  await userEvent.type(within(dialog).getByLabelText('Use by'), '2027-01-02');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Finish' }));
  await waitFor(() => expect(sent('POST', '/api/batches/5/finish')).toHaveLength(1));
  expect(sent('POST', '/api/batches/5/finish')[0].body).toEqual({ finished_on: TODAY, yield_amount: 200, yield_unit: 'ml', expires_on: '2027-01-02' });
});

it('leaves the jar unit blank with a note when the yield unit is not a cabinet unit', async () => {
  recipeYield = { scaled_yield_amount: 6, yield_unit: 'tsp' };
  const dialog = await openFinish();
  await waitFor(() => expect(within(dialog).getByLabelText('Yield unit')).toHaveValue('tsp'));
  expect(within(dialog).getByLabelText('Unit')).toHaveValue('');
  expect(within(dialog).getByText('Pick a cabinet unit for the jar')).toBeInTheDocument();
  await userEvent.selectOptions(within(dialog).getByLabelText('Unit'), 'ml');
  expect(within(dialog).queryByText('Pick a cabinet unit for the jar')).toBeNull();
});

it('clears the jar amount and asks for it when the jar unit differs from the yield unit', async () => {
  recipeYield = { scaled_yield_amount: 6, yield_unit: 'tsp' };
  const dialog = await openFinish();
  await waitFor(() => expect(within(dialog).getByLabelText('Yield unit')).toHaveValue('tsp'));
  await userEvent.selectOptions(within(dialog).getByLabelText('Unit'), 'ml');
  expect(within(dialog).getByLabelText('Amount')).toHaveValue(null);
  expect(within(dialog).getByText('Enter the amount in ml.')).toBeInTheDocument();
  await userEvent.type(within(dialog).getByLabelText('Amount'), '30');
  expect(within(dialog).getByLabelText('Amount')).toHaveValue(30);
});

it('shows a load failure inside the dialog with Try again, for the recipe and the sections', async () => {
  failLoads = new Set(['recipe', 'sections']);
  const dialog = await openFinish();
  expect(await within(dialog).findByText('The recipe would not load.')).toBeInTheDocument();
  expect(await within(dialog).findByText('The sections would not load.')).toBeInTheDocument();
  expect(within(dialog).getAllByRole('alert')).toHaveLength(2);
  failLoads = new Set();
  const before = calls.filter(c => c.url === '/api/sections').length;
  await userEvent.click(within(dialog).getAllByRole('button', { name: 'Try again' })[1]);
  await waitFor(() => expect(calls.filter(c => c.url === '/api/sections').length).toBe(before + 1));
  await waitFor(() => expect(within(dialog).queryByText('The sections would not load.')).toBeNull());
  await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(within(dialog).getByLabelText('Yield amount')).toHaveValue(200));
});

it('shows server errors inside the dialog, on the field and as an alert', async () => {
  failFinish = { status: 400, body: { error: 'Please fix the highlighted fields.', details: { 'add_to_cabinet.name': 'Add a name' } } };
  const dialog = await openFinish();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Finish' }));
  expect(await within(dialog).findByText('Add a name')).toBeInTheDocument();
  expect(within(dialog).getAllByRole('alert').some(a => a.textContent === 'Please fix the highlighted fields.')).toBe(true);
  failFinish = { status: 409, body: { error: 'This batch is already finished.' } };
  await userEvent.click(within(dialog).getByRole('button', { name: 'Finish' }));
  await waitFor(() => expect(within(dialog).getAllByRole('alert').some(a => a.textContent === 'This batch is already finished.')).toBe(true));
});

it('undoes a finish', async () => {
  batch = { ...batch, status: 'finished', finished_on: '2026-10-08', yield_amount: 200, yield_unit: 'ml', expires_on: '2027-04-08' };
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'Undo finishing' }));
  await waitFor(() => expect(sent('POST', '/api/batches/5/unfinish')).toHaveLength(1));
  expect(await screen.findByRole('button', { name: 'Finish this batch' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Finished' })).toBeNull();
});

it('says so when the batch cannot be opened and offers Try again', async () => {
  const real = global.fetch;
  global.fetch = vi.fn(async (url, opts) => (url === '/api/batches/5' && (opts?.method ?? 'GET') === 'GET'
    ? new Response(JSON.stringify({ error: 'That batch is not in the journal.' }), { status: 404 }) : real(url, opts)));
  open();
  expect(await screen.findByText('That batch is not in the journal.')).toBeInTheDocument();
  global.fetch = real;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' })).toBeInTheDocument();
});

it('links a herb only while it is still in the grimoire', async () => {
  batch.lines.push({ id: 3, herb_id: 9, herb_live: false, name: 'Gone herb', amount: 1, unit: 'g', item_id: null, drawn_amount: null, drawn_unit: null, item: null });
  open();
  await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  expect(screen.getByRole('link', { name: 'Calendula' })).toHaveAttribute('href', '/grimoire/3');
  expect(screen.queryByRole('link', { name: 'Gone herb' })).toBeNull();
  expect(screen.getByText('Gone herb')).toBeInTheDocument();
});

it('moves focus to the Finished heading after finishing and to the page heading after undoing', async () => {
  const dialog = await openFinish();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Finish' }));
  const heading = await screen.findByRole('heading', { level: 2, name: 'Finished' });
  await waitFor(() => expect(heading).toHaveFocus());
  await userEvent.click(screen.getByRole('button', { name: 'Undo finishing' }));
  const h1 = await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  await waitFor(() => expect(h1).toHaveFocus());
});

it('returns focus to the step Edit button after a step is saved', async () => {
  open();
  const panel = await stepsPanel();
  await userEvent.click(within(panel).getByRole('button', { name: 'Edit Strain and bottle' }));
  await userEvent.click(within(panel).getByRole('button', { name: 'Save step' }));
  await waitFor(() => expect(within(panel).getByRole('button', { name: 'Edit Strain and bottle' })).toHaveFocus());
});

it('does not offer Delete while the journal is being edited', async () => {
  open();
  await screen.findByRole('heading', { level: 1, name: 'Calendula oil, Oct 1' });
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
});
