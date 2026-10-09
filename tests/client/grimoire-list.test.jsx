import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

const HERBS = [
  { id: 3, slug: 'lavender', common_name: 'Lavender', latin_name: 'Lavandula angustifolia', parts_used: ['flower'], planet: 'Mercury', element: 'Air', ahpa_class: '1', has_cautions: false, jar_count: 2, cover: null },
  { id: 4, slug: 'mugwort', common_name: 'Mugwort', latin_name: 'Artemisia vulgaris', parts_used: ['leaf'], planet: 'Venus', element: 'Earth', ahpa_class: '2b', has_cautions: true, jar_count: 0, cover: null },
];
let requests;
let herbs;
beforeEach(() => {
  requests = [];
  herbs = HERBS;
  global.fetch = vi.fn(async url => {
    requests.push(url);
    const json = b => new Response(JSON.stringify(b), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url.startsWith('/api/herbs')) return json(herbs);
    return json({});
  });
});
const open = (path = '/grimoire') => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></ConfirmProvider></ToastProvider>);
const lastHerbsUrl = () => requests.filter(u => u.startsWith('/api/herbs')).at(-1);

it('shows the header, the not-medical-advice note and an add link', async () => {
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Grimoire' })).toBeInTheDocument();
  expect(screen.getByText(/Not medical advice/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add an herb' })).toHaveAttribute('href', '/grimoire/new');
});

it('lists herbs as cards with links and badges', async () => {
  open();
  const link = await screen.findByRole('link', { name: 'Lavender' });
  expect(link).toHaveAttribute('href', '/grimoire/3');
  expect(screen.getByText('Lavandula angustifolia').tagName).toBe('EM');
  expect(screen.getByText('Mercury, Air')).toBeInTheDocument();
  expect(screen.getByText('In your cabinet (2 jars)')).toBeInTheDocument();
  expect(screen.getAllByText('Cautions')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Mugwort' })).toHaveAttribute('href', '/grimoire/4');
});

it('sends filters from the URL and the toolbar to the API', async () => {
  const user = userEvent.setup();
  open('/grimoire?planet=Venus');
  await screen.findByRole('link', { name: 'Lavender' });
  expect(lastHerbsUrl()).toBe('/api/herbs?planet=Venus');
  await user.click(screen.getByRole('checkbox', { name: 'Only herbs in my cabinet' }));
  await waitFor(() => expect(lastHerbsUrl()).toContain('has_jars=1'));
  await user.click(screen.getByRole('checkbox', { name: 'Has a pregnancy caution' }));
  await waitFor(() => expect(lastHerbsUrl()).toContain('caution=pregnancy'));
  await user.selectOptions(screen.getByLabelText('Part used'), 'bulb');
  await waitFor(() => expect(lastHerbsUrl()).toContain('part=bulb'));
  await user.selectOptions(screen.getByLabelText('Element'), 'Fire');
  await waitFor(() => expect(lastHerbsUrl()).toContain('element=Fire'));
  await user.type(screen.getByLabelText('Search'), 'lav');
  await waitFor(() => expect(lastHerbsUrl()).toContain('q=lav'));
});

it('says so when nothing matches', async () => {
  herbs = [];
  open('/grimoire?q=zzz');
  expect(await screen.findByText('No herbs match.')).toBeInTheDocument();
});

it('invites the first herb when the grimoire is empty', async () => {
  herbs = [];
  open();
  const card = await screen.findByRole('region', { name: 'The grimoire is empty' });
  expect(within(card).getByRole('link', { name: 'Add an herb' })).toHaveAttribute('href', '/grimoire/new');
});
