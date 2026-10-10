import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

const active = [
  { id: 1, name: 'Calendula oil, Oct 1', recipe_id: 7, recipe_name: 'Calendula oil', type_name: 'Infused oil', start_date: '2026-10-01', finished_on: null, next_step: { title: 'Strain and bottle', due_on: '2099-10-30' }, open_steps: 1, cover: null },
  { id: 2, name: 'Old tincture', recipe_id: null, recipe_name: null, type_name: null, start_date: '2026-08-01', finished_on: null, next_step: { title: 'Shake', due_on: '2020-01-02' }, open_steps: 2, cover: null },
];
const finished = [
  { id: 3, name: 'Rose salve', recipe_id: 8, recipe_name: 'Rose salve', type_name: 'Salve', start_date: '2026-07-01', finished_on: '2026-07-20', next_step: null, open_steps: 0, cover: null },
];
let calls;
let fail;
beforeEach(() => {
  calls = [];
  fail = false;
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push(url);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url.startsWith('/api/batches')) {
      if (fail) return json({ error: 'Could not load the journal' }, 500);
      const q = new URLSearchParams(url.split('?')[1]);
      let rows = q.get('status') === 'finished' ? finished : active;
      if (q.get('q')) rows = rows.filter(r => r.name.toLowerCase().includes(q.get('q').toLowerCase()));
      return json(rows);
    }
    return json({});
  });
});

const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};

it('lists steeping batches with the next step and an overdue badge', async () => {
  open('/batches');
  expect(await screen.findByRole('heading', { level: 1, name: 'Batch journal' })).toBeInTheDocument();
  expect(screen.getByText("What you've made, and what's still steeping")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start a batch' })).toHaveAttribute('href', '/batches/new');
  const link = await screen.findByRole('link', { name: 'Calendula oil, Oct 1' });
  expect(link).toHaveAttribute('href', '/batches/1');
  expect(screen.getByText('Calendula oil, Infused oil')).toBeInTheDocument();
  expect(screen.getByText('Started Oct 1, 2026')).toBeInTheDocument();
  expect(screen.getByText('Strain and bottle, due Oct 30')).toBeInTheDocument();
  expect(screen.getByText('Shake, due Jan 2')).toBeInTheDocument();
  expect(screen.getAllByText('Overdue')).toHaveLength(1);
  expect(calls).toContain('/api/batches?status=active');
});

it('switches to the finished tab and keeps it in the URL', async () => {
  const user = userEvent.setup();
  const router = open('/batches');
  await screen.findByRole('link', { name: 'Old tincture' });
  expect(screen.getByRole('link', { name: 'Steeping' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('link', { name: 'Finished' }));
  expect(await screen.findByRole('link', { name: 'Rose salve' })).toBeInTheDocument();
  expect(screen.getByText('Finished Jul 20, 2026')).toBeInTheDocument();
  expect(router.state.location.search).toContain('status=finished');
});

it('shows the empty states', async () => {
  global.fetch = vi.fn(async () => new Response('[]', { status: 200 }));
  const user = userEvent.setup();
  open('/batches');
  expect(await screen.findByText('Nothing steeping. Start a batch from a recipe.')).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Finished' }));
  expect(await screen.findByText('No finished batches yet.')).toBeInTheDocument();
});

it('searches the journal', async () => {
  const user = userEvent.setup();
  open('/batches');
  await screen.findByRole('link', { name: 'Old tincture' });
  await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'tinct');
  await waitFor(() => expect(calls).toContain('/api/batches?status=active&q=tinct'));
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Calendula oil, Oct 1' })).not.toBeInTheDocument());
});

it('shows a load error with Try again', async () => {
  const user = userEvent.setup();
  fail = true;
  open('/batches');
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the journal');
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Old tincture' })).toBeInTheDocument();
});

it('carries the scale from the recipe page into Make this recipe', async () => {
  const recipe = {
    id: 7, name: 'Calendula oil', type: { name: 'Infused oil' }, factor: 2, yield_amount: 100, yield_unit: 'ml', scaled_yield_amount: 200,
    steps: null, ingredients: [], cautions: [], photos: [], effective_wait_days: 0, effective_shelf_life_days: 90,
    needs_patch_test: false, label_caution: null,
  };
  global.fetch = vi.fn(async url => new Response(JSON.stringify(url.startsWith('/api/recipes/7') ? recipe : []), { status: 200 }));
  open('/recipes/7?scale=2');
  const link = await screen.findByRole('link', { name: 'Make this recipe' });
  expect(link).toHaveAttribute('href', '/batches/new?recipe=7&scale=2');
});
