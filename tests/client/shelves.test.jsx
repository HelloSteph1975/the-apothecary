import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const SECTIONS = [{ id: 1, name: 'Herbs', kind: 'herb', sort_order: 0 }, { id: 11, name: 'Containers', kind: 'supply', sort_order: 10 }, { id: 3, name: 'Waxes', kind: 'supply', sort_order: 2 }];
const ITEMS = [
  { id: 7, section_id: 1, section_name: 'Herbs', name: 'Calendula', latin_name: 'Calendula officinalis', amount: 40, unit: 'g', status: { low: true, expiring: false, expired: false }, source_kind: 'bought', last_supplier_name: 'Moonvale', cover: null },
  { id: 8, section_id: 11, section_name: 'Containers', name: 'Amber dropper bottle', size_label: '30 ml', amount: 24, unit: 'count', status: {}, source_kind: 'gifted', source_from: 'Rowan', cover: null },
];
let requests;
beforeEach(() => {
  requests = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    requests.push(url);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (opts.method === 'DELETE') {
      return url.includes('move_to')
        ? json({ ok: true, restore: '/api/sections/3/restore' })
        : json({ error: 'Move what is in this section first.', details: { items: 2 } }, 409);
    }
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url === '/api/sections') return json(SECTIONS);
    if (url === '/api/suppliers') return json([{ id: 2, name: 'Moonvale' }]);
    if (url === '/api/storage-spots') return json(['Top shelf']);
    if (url.startsWith('/api/items')) {
      const u = new URL(url, 'http://x');
      if (u.searchParams.get('q') === 'zzz') return json([]);
      if (u.searchParams.get('include_used_up') === '1') return json([...ITEMS, { id: 9, section_id: 3, section_name: 'Waxes', name: 'Beeswax', amount: 0, unit: 'g', status: {}, source_kind: 'bought', used_up_at: '2026-10-01T00:00:00Z', cover: null }]);
      return json(u.searchParams.get('status') === 'low' ? ITEMS.slice(0, 1) : ITEMS);
    }
    return json({});
  });
});
const open = (path = '/cabinet') => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></ConfirmProvider></ToastProvider>);

it('groups items by section with amounts, badges and sources', async () => {
  open();
  const herbs = await screen.findByRole('region', { name: /Herbs/ });
  expect(within(herbs).getByRole('link', { name: /Calendula/ })).toHaveAttribute('href', '/cabinet/items/7');
  expect(within(herbs).getByText('Running low')).toBeInTheDocument();
  expect(within(herbs).getByText('Bought from Moonvale')).toBeInTheDocument();
  const containers = screen.getByRole('region', { name: /Containers/ });
  expect(within(containers).getByText('24')).toBeInTheDocument();
  expect(within(containers).getByText('Gifted by Rowan')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /Waxes/ })).toBeNull();
  const empty = screen.getByRole('region', { name: /Empty shelves/ });
  expect(empty).toHaveAccessibleName('Empty shelves (1)');
  expect(within(empty).getByRole('link', { name: 'Add to Waxes' })).toHaveAttribute('href', '/cabinet/new?section=3');
});

it('filters from the URL and the Show menu, hiding empty shelves', async () => {
  const user = userEvent.setup();
  open('/cabinet?status=low');
  await screen.findByRole('link', { name: /Calendula/ });
  expect(requests.some(u => u.startsWith('/api/items') && u.includes('status=low'))).toBe(true);
  expect(screen.queryByRole('region', { name: /Waxes/ })).toBeNull();
  expect(screen.queryByRole('region', { name: /Empty shelves/ })).toBeNull();
  await user.selectOptions(screen.getByLabelText('Show'), 'all');
  await waitFor(() => expect(screen.getByRole('link', { name: /Amber dropper bottle/ })).toBeInTheDocument());
});

it('has an add button and the shelves and suppliers tabs', async () => {
  open();
  expect(await screen.findByRole('link', { name: 'Shelves' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Suppliers' })).toHaveAttribute('href', '/cabinet/suppliers');
  expect(screen.getByRole('link', { name: /Add to the cabinet/ })).toHaveAttribute('href', '/cabinet/new');
});

it('moves items to another section before deleting one', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('region', { name: /Herbs/ });
  await user.click(screen.getByRole('button', { name: 'Manage sections' }));
  await user.click(await screen.findByRole('button', { name: 'Delete Waxes' }));
  const select = await screen.findByLabelText('Move its 2 items to:');
  expect(select).toHaveFocus();
  await user.selectOptions(select, 'Herbs');
  await user.click(screen.getByRole('button', { name: 'Move and delete' }));
  await waitFor(() => expect(requests).toContain('/api/sections/3?move_to=1'));
  expect(await screen.findByText('Deleted Waxes')).toBeInTheDocument();
});

it('shows a Used up badge for used-up items', async () => {
  open('/cabinet?include_used_up=1');
  const waxes = await screen.findByRole('region', { name: /Waxes/ });
  expect(within(waxes).getByText('Used up')).toBeInTheDocument();
});

it('says so when filters match nothing', async () => {
  open('/cabinet?q=zzz');
  expect(await screen.findByText('Nothing matches those filters.')).toBeInTheDocument();
});
