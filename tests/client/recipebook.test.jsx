import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { daysText, shelfText, RECIPE_UNITS, RECIPE_ICONS } from '../../client/src/lib/recipes.jsx';

const TYPES = [
  { id: 1, name: 'Salve', icon: 'jar', is_topical: 1, recipe_count: 2 },
  { id: 2, name: 'Tea blend', icon: 'cup', is_topical: 0, recipe_count: 1 },
];
const RECIPES = [
  { id: 5, name: 'Calendula salve', type_id: 1, type_name: 'Salve', type_icon: 'jar', is_topical: 1, yield_amount: 120, yield_unit: 'ml', ingredient_count: 4, herb_names: ['Calendula', 'Comfrey', 'Plantain', 'Yarrow', 'Rose'], cover: null },
  { id: 6, name: 'Evening tea', type_id: 2, type_name: 'Tea blend', type_icon: 'cup', is_topical: 0, yield_amount: null, yield_unit: null, ingredient_count: 2, herb_names: ['Chamomile'], cover: 'abc.jpg' },
];
let requests;
beforeEach(() => {
  requests = [];
  global.fetch = vi.fn(async url => {
    requests.push(url);
    const json = b => new Response(JSON.stringify(b), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url === '/api/recipe-types') return json(TYPES);
    if (url === '/api/herbs') return json([{ id: 3, common_name: 'Calendula' }]);
    if (url.startsWith('/api/recipes')) {
      const u = new URL(url, 'http://x');
      if (u.searchParams.get('q') === 'none') return json([]);
      return json(RECIPES);
    }
    return json({});
  });
});
const open = (path = '/recipes') => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></ConfirmProvider></ToastProvider>);

it('writes waits and shelf lives in plain words', () => {
  expect([null, 0, 1, 7, 14, 10].map(daysText)).toEqual(['', 'Ready when made', '1 day', '1 week', '2 weeks', '10 days']);
  expect([null, 0, 7, 365, 730, 90].map(shelfText)).toEqual(['', 'Ready when made', '1 week', '1 year', '2 years', '90 days']);
  expect(RECIPE_UNITS).toHaveLength(13);
  expect(RECIPE_ICONS).toHaveLength(14);
});

it('shows recipe cards with links, type, yield and herbs', async () => {
  open();
  const card = (await screen.findByRole('link', { name: 'Calendula salve' })).closest('section');
  expect(within(card).getByRole('link', { name: 'Calendula salve' })).toHaveAttribute('href', '/recipes/5');
  expect(within(card).getByText('Salve')).toBeInTheDocument();
  expect(within(card).getByText('120 ml')).toBeInTheDocument();
  expect(within(card).getByText(/Calendula, Comfrey, Plantain/)).toBeInTheDocument();
  expect(within(card).getByText(/and 2 more/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add a recipe' })).toHaveAttribute('href', '/recipes/new');
  expect(screen.getByRole('link', { name: 'Recipe types' })).toHaveAttribute('href', '/recipes/types');
  const tea = screen.getByRole('link', { name: 'Evening tea' }).closest('section');
  expect(tea.querySelector('img')).toHaveAttribute('src', '/photos/abc.jpg');
});

it('sends the filters to the API', async () => {
  const user = userEvent.setup();
  open('/recipes?type_id=2');
  await screen.findByRole('link', { name: 'Evening tea' });
  expect(requests.some(u => u.startsWith('/api/recipes') && u.includes('type_id=2'))).toBe(true);
  await user.selectOptions(await screen.findByLabelText('Herb'), '3');
  await waitFor(() => expect(requests.some(u => u.includes('herb_id=3'))).toBe(true));
  await user.click(screen.getByLabelText('Only skin recipes'));
  await waitFor(() => expect(requests.some(u => u.includes('topical=1'))).toBe(true));
  await user.type(screen.getByLabelText('Search'), 'none');
  await waitFor(() => expect(requests.some(u => u.includes('q=none'))).toBe(true));
  expect(await screen.findByText('No recipes match.')).toBeInTheDocument();
});

it('shows the empty book with a way in', async () => {
  global.fetch.mockImplementation(async url => new Response(JSON.stringify(url.startsWith('/api/recipes') ? [] : url === '/api/settings' ? { keeper_name: '' } : url === '/api/health' ? { ok: true } : []), { status: 200 }));
  open();
  expect(await screen.findByRole('region', { name: 'Your recipe book is empty' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Add a recipe' }).length).toBeGreaterThan(0);
});
