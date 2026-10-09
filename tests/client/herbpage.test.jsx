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

const open = () => render(
  <ToastProvider><ConfirmProvider>
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/grimoire/5'] })} />
  </ConfirmProvider></ToastProvider>,
);

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
  expect(screen.getByText(/Lavandula angustifolia/)).toBeInTheDocument();
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

it('deletes with undo and returns to the grimoire', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('heading', { name: 'Lavender' });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  const dialog = screen.queryByRole('dialog');
  if (dialog) await user.click(within(dialog).getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/herbs/5')).toBe(true));
  expect(await screen.findByRole('heading', { name: 'Grimoire' })).toBeInTheDocument();
});

it('shows the garden panel with harvest part and timing', async () => {
  open();
  const garden = await screen.findByRole('region', { name: 'In the garden' });
  expect(within(garden).getByText('Part harvested').nextElementSibling).toHaveTextContent('Flower spikes');
  expect(within(garden).getByText('Harvest timing').nextElementSibling).toHaveTextContent('Midsummer');
});
