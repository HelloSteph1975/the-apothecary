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
  id: 5, common_name: 'Lavender', latin_name: 'Lavandula angustifolia', family: 'Lamiaceae',
  other_names: [], parts_used: ['flower'], preparations: ['tea', 'oil'], uses: 'Calming evening tea.', taste: 'Floral', energetics: 'Cooling',
  caution_pregnancy: 'Skip in early pregnancy.', caution_medications: 'May add to sedatives.', caution_conditions: '', caution_duration: '', caution_topical: '',
  ahpa_class: '1', planet: 'Venus', element: 'Air', gender: 'Feminine', zodiac: ['Gemini'], associations: ['peace', 'sleep'],
  garden_harvest_part: 'Flower spikes', garden_harvest_timing: 'Midsummer', garden_sun: 'Full sun', garden_water: 'Low', garden_companions: ['Rosemary'],
  notes: 'Grows by the gate.', is_starter: 1,
  sources: [
    { id: 1, title: 'Herbal Book', author: 'A. Author', year: 2010, url: 'https://example.com/book', covers: ['uses', 'safety'] },
    { id: 2, title: 'Odd Link', author: null, year: null, url: 'javascript:alert(1)', covers: [] },
  ],
  photos: [],
  jars: [{ id: 9, name: 'Lavender buds', amount: 30, unit: 'g', size_label: null, expires_on: '2026-10-12', status: { low: false, expiring: true, expired: false } }],
};

let herb;
let calls;
let sections;
beforeEach(() => {
  calls = [];
  herb = base;
  sections = [{ id: 3, name: 'Tools', kind: 'supply' }, { id: 4, name: 'Herbs', kind: 'herb' }];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.startsWith('/api/herbs/5?')) return json(herb);
    if (url === '/api/herbs/5' && method === 'DELETE') return json({ ok: true, restore: '/api/herbs/5/restore' });
    if (url === '/api/sections') return json(sections);
    if (url.startsWith('/api/herbs?')) return json([]);
    return json({});
  });
});

const open = () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/grimoire/5'] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};

it('puts the cautions panel before the uses, with labels and the AHPA class', async () => {
  open();
  const cautions = await screen.findByRole('region', { name: 'Before you use it' });
  expect(within(cautions).getByText('Pregnancy and nursing')).toBeInTheDocument();
  expect(within(cautions).getByText('Skip in early pregnancy.')).toBeInTheDocument();
  expect(within(cautions).getByText('Medicines')).toBeInTheDocument();
  expect(within(cautions).queryByText('Health conditions')).not.toBeInTheDocument();
  expect(within(cautions).getByText('Class 1: generally safe with sensible use')).toBeInTheDocument();
  expect(within(cautions).getByText(/Not medical advice/)).toBeInTheDocument();
  const uses = screen.getByRole('region', { name: 'Uses in tradition' });
  expect(cautions.compareDocumentPosition(uses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Lavender' })).toBeInTheDocument();
  expect(screen.getByText('Lavandula angustifolia, Lamiaceae')).toBeInTheDocument();
  expect(screen.getByText('Folk tradition, not fact.')).toBeInTheDocument();
});

it('says so when no cautions are recorded and hides empty panels', async () => {
  herb = { ...base, caution_pregnancy: '', caution_medications: '', ahpa_class: null, garden_harvest_part: '', garden_harvest_timing: '', garden_sun: '', garden_water: '', garden_companions: [], sources: [], jars: [], notes: '' };
  open();
  const cautions = await screen.findByRole('region', { name: 'Before you use it' });
  expect(within(cautions).getByText("No cautions recorded. That doesn't mean it's safe for everyone.")).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'In the garden' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Sources' })).not.toBeInTheDocument();
  expect(within(await screen.findByRole('region', { name: 'In your cabinet' })).getByText('No jar of this herb yet.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument();
});

it('lists jars and links to add one with the herb param', async () => {
  open();
  const cab = await screen.findByRole('region', { name: 'In your cabinet' });
  expect(within(cab).getByRole('link', { name: 'Lavender buds' })).toHaveAttribute('href', '/cabinet/items/9');
  expect(within(cab).getByText(/30 g/)).toBeInTheDocument();
  expect(within(cab).getByText('Use soon')).toBeInTheDocument();
  await waitFor(() => expect(within(cab).getByRole('link', { name: 'Add a jar of this herb' })).toHaveAttribute('href', '/cabinet/new?section=4&herb=5'));
});

it('links to add a jar without a section when there is no herb section', async () => {
  sections = [{ id: 3, name: 'Tools', kind: 'supply' }];
  open();
  const cab = await screen.findByRole('region', { name: 'In your cabinet' });
  expect(within(cab).getByRole('link', { name: 'Add a jar of this herb' })).toHaveAttribute('href', '/cabinet/new?herb=5');
});

it('shows sources with safe links only', async () => {
  open();
  const src = await screen.findByRole('region', { name: 'Sources' });
  expect(within(src).getByRole('link', { name: 'Herbal Book' })).toHaveAttribute('href', 'https://example.com/book');
  expect(within(src).getByText('Odd Link')).toBeInTheDocument();
  expect(within(src).queryByRole('link', { name: 'Odd Link' })).not.toBeInTheDocument();
});

it('deletes with undo and returns to the grimoire, and undo comes back to the herb', async () => {
  const user = userEvent.setup();
  const router = open();
  await screen.findByRole('heading', { level: 1, name: 'Lavender' });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.filter(c => c.method === 'DELETE').map(c => c.url)).toEqual(['/api/herbs/5']));
  expect(await screen.findByRole('heading', { level: 1, name: 'Grimoire' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/grimoire');
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/herbs/5/restore')).toBe(true));
  await waitFor(() => expect(router.state.location.pathname).toBe('/grimoire/5'));
  expect(await screen.findByRole('heading', { level: 1, name: 'Lavender' })).toBeInTheDocument();
});

it('shows the garden panel with harvest part and timing', async () => {
  open();
  const garden = await screen.findByRole('region', { name: 'In the garden' });
  expect(within(garden).getByText('Part harvested').nextElementSibling).toHaveTextContent('Flower spikes');
  expect(within(garden).getByText('Harvest timing').nextElementSibling).toHaveTextContent('Midsummer');
});

it('shows other names and parts used', async () => {
  herb = { ...base, other_names: ['Tulsi', 'Holy lavender'], parts_used: ['flower', 'leaf'] };
  open();
  expect(await screen.findByText('Also called Tulsi, Holy lavender')).toBeInTheDocument();
  expect(screen.getByText('Parts used')).toBeInTheDocument();
  expect(screen.getByText('Flower, leaf')).toBeInTheDocument();
});

it('shows the uses panel when only parts used is set', async () => {
  herb = { ...base, uses: null, preparations: [], taste: null, energetics: null, other_names: [], parts_used: ['root'] };
  open();
  expect(await screen.findByRole('heading', { name: 'Uses in tradition' })).toBeInTheDocument();
  expect(screen.getByText('Root')).toBeInTheDocument();
});

it('lists recipes with this herb and always offers a link to write one', async () => {
  herb = { ...base, recipes: [{ id: 3, name: 'Calming tea', type_name: 'tea blend' }, { id: 4, name: 'Sleep salve', type_name: 'salve' }] };
  open();
  const panel = await screen.findByRole('region', { name: 'Recipes with this herb' });
  expect(within(panel).getByRole('link', { name: 'Calming tea' })).toHaveAttribute('href', '/recipes/3');
  expect(within(panel).getByText(/tea blend/)).toBeInTheDocument();
  expect(within(panel).getByRole('link', { name: 'Sleep salve' })).toHaveAttribute('href', '/recipes/4');
  expect(within(panel).getByRole('link', { name: 'Write a recipe with this herb' })).toHaveAttribute('href', '/recipes/new?herb=5');
});

it('hides the recipes panel when there are none but keeps the write link', async () => {
  herb = { ...base, recipes: [] };
  open();
  await screen.findByRole('region', { name: 'In your cabinet' });
  expect(screen.queryByRole('region', { name: 'Recipes with this herb' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Write a recipe with this herb' })).toHaveAttribute('href', '/recipes/new?herb=5');
});
