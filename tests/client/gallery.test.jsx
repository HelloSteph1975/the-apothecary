process.env.TZ = 'America/Mexico_City';
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';

const OWNERS = {
  item: ['Rose jar', '/cabinet/items/'], herb: ['Mugwort', '/grimoire/'], journal: ['Full moon', '/journal/'],
};
const photo = (id, kind = 'item', over = {}) => ({
  id, filename: `p${id}.jpg`, caption: `Caption ${id}`, created_at: '2026-10-09 12:00:00',
  owner: { kind, id: id + 100, name: OWNERS[kind][0], link: `${OWNERS[kind][1]}${id + 100}` }, ...over,
});
let calls;
let photos;
let kinds;
beforeEach(() => {
  calls = [];
  photos = () => ({ photos: [], total: 0, page: 1 });
  kinds = [];
  global.fetch = vi.fn(async url => {
    calls.push(url);
    const json = b => new Response(JSON.stringify(b), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url === '/api/gallery/kinds') return json(kinds);
    if (url.startsWith('/api/gallery?')) return json(photos(new URL(url, 'http://x').searchParams));
    return json({});
  });
});
const open = (path = '/journal/photos') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};
const galleryCalls = () => calls.filter(c => c.startsWith('/api/gallery?'));

it('shows tiles with alt text, captions and owner links', async () => {
  photos = () => ({ photos: [photo(1), photo(2, 'herb', { caption: '' })], total: 2, page: 1 });
  kinds = [{ kind: 'item', count: 1 }, { kind: 'herb', count: 1 }];
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Photos' })).toBeInTheDocument();
  expect(screen.getByText("Everything you've photographed")).toBeInTheDocument();
  const img = await screen.findByAltText('Caption 1');
  expect(img).toHaveAttribute('src', '/photos/p1.jpg');
  expect(img).toHaveAttribute('loading', 'lazy');
  expect(screen.getByAltText('Mugwort photo')).toBeInTheDocument();
  const tile = img.closest('li');
  expect(within(tile).getByText('Caption 1')).toBeInTheDocument();
  const link = within(tile).getByRole('link', { name: /Rose jar/ });
  expect(link).toHaveAttribute('href', '/cabinet/items/101');
  expect(link).toHaveTextContent('Jar: Rose jar');
});

it('filters reach the URL and the API, and the kind list shows counts', async () => {
  photos = () => ({ photos: [photo(1)], total: 1, page: 1 });
  kinds = [{ kind: 'item', count: 12 }, { kind: 'herb', count: 3 }];
  const router = open('/journal/photos?kind=herb&from=2026-10-01&to=2026-10-09');
  await screen.findByAltText('Caption 1');
  expect(galleryCalls()[0]).toBe('/api/gallery?kind=herb&from=2026-10-01&to=2026-10-09');
  const select = screen.getByLabelText('Kind');
  expect(select).toHaveValue('herb');
  expect(within(select).getByRole('option', { name: 'Jars (12)' })).toBeInTheDocument();
  expect(within(select).getByRole('option', { name: 'Herbs (3)' })).toBeInTheDocument();
  await userEvent.selectOptions(select, 'item');
  await waitFor(() => expect(router.state.location.search).toContain('kind=item'));
  await waitFor(() => expect(galleryCalls().at(-1)).toContain('kind=item'));
  await userEvent.clear(screen.getByLabelText('From'));
  await waitFor(() => expect(router.state.location.search).not.toContain('from='));
  expect(router.state.location.search).toContain('to=2026-10-09');
});

it('loads more photos', async () => {
  photos = p => (p.get('page') === '2'
    ? { photos: [photo(49)], total: 49, page: 2 }
    : { photos: Array.from({ length: 48 }, (_, i) => photo(i + 1)), total: 49, page: 1 });
  open();
  await screen.findByAltText('Caption 1');
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findByAltText('Caption 49')).toBeInTheDocument();
  expect(galleryCalls().at(-1)).toBe('/api/gallery?page=2');
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
});

it('opens a larger view with Previous, Next, arrow keys and Escape returning focus', async () => {
  photos = () => ({ photos: [photo(1), photo(2, 'journal'), photo(3)], total: 3, page: 1 });
  open();
  await screen.findByAltText('Caption 2');
  const tile2 = screen.getByRole('button', { name: /Caption 2/ });
  tile2.focus();
  await userEvent.keyboard('{Enter}');
  const dialog = await screen.findByRole('dialog');
  const big = dialog.querySelector('img');
  expect(big).toHaveAttribute('src', '/photos/p2.jpg');
  expect(big).toHaveAttribute('alt', '');
  expect(within(dialog).getByText('Caption 2')).toBeInTheDocument();
  expect(within(dialog).getByText('Oct 9, 2026')).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: /Full moon/ })).toHaveAttribute('href', '/journal/102');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
  expect(within(dialog).getByText('Caption 3')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Previous' }));
  await userEvent.keyboard('{ArrowLeft}');
  expect(within(dialog).getByText('Caption 1')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.keyboard('{ArrowRight}');
  expect(within(dialog).getByText('Caption 2')).toBeInTheDocument();
  // jsdom has no Escape-to-cancel; browsers fire this 'cancel' event on the dialog.
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: /Caption 2/ })).toHaveFocus());
});

it('shows both empty states', async () => {
  open();
  expect(await screen.findByText('No photos yet. Add them to jars, herbs, recipes, batches, tasks or journal entries.')).toBeInTheDocument();
});

it('says no photos match when filters are set', async () => {
  open('/journal/photos?kind=herb');
  expect(await screen.findByText('No photos match.')).toBeInTheDocument();
});

it('shows an error with Try again', async () => {
  const base = global.fetch;
  global.fetch = vi.fn(async (url, o) => (url.startsWith('/api/gallery?')
    ? new Response(JSON.stringify({ error: 'Nope' }), { status: 500 }) : base(url, o)));
  open();
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('ignores arrow keys held with a modifier in the larger view', async () => {
  photos = () => ({ photos: [photo(1), photo(2), photo(3)], total: 3, page: 1 });
  open();
  await screen.findByAltText('Caption 2');
  await userEvent.click(screen.getByRole('button', { name: /Caption 2/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.keyDown(dialog, { key: 'ArrowRight', ctrlKey: true });
  fireEvent.keyDown(dialog, { key: 'ArrowLeft', altKey: true });
  fireEvent.keyDown(dialog, { key: 'ArrowRight', shiftKey: true });
  fireEvent.keyDown(dialog, { key: 'ArrowRight', metaKey: true });
  expect(within(dialog).getByText('Caption 2')).toBeInTheDocument();
  expect(within(dialog).queryByText('Caption 3')).toBeNull();
  expect(within(dialog).queryByText('Caption 1')).toBeNull();
});

it('keeps the photo alt text when there is no caption to show', async () => {
  photos = () => ({ photos: [photo(2, 'herb', { caption: '' })], total: 1, page: 1 });
  open();
  await userEvent.click(await screen.findByRole('button', { name: /Mugwort photo/ }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByAltText('Mugwort photo')).toBeInTheDocument();
});

it('shows an error when loading more fails', async () => {
  const base = global.fetch;
  photos = () => ({ photos: Array.from({ length: 48 }, (_, i) => photo(i + 1)), total: 49, page: 1 });
  global.fetch = vi.fn(async (url, o) => (url.includes('page=2')
    ? new Response(JSON.stringify({ error: 'Could not load more.' }), { status: 500 }) : base(url, o)));
  open();
  await screen.findByAltText('Caption 1');
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findByText('Could not load more.')).toHaveAttribute('role', 'alert');
  expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();
});

it('starts again from the first page when a filter changes', async () => {
  photos = p => (p.get('page') === '2'
    ? { photos: [photo(49)], total: 49, page: 2 }
    : { photos: Array.from({ length: 48 }, (_, i) => photo(i + 1)), total: 49, page: 1 });
  kinds = [{ kind: 'item', count: 49 }];
  open();
  await screen.findByAltText('Caption 1');
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByAltText('Caption 49');
  await userEvent.selectOptions(screen.getByLabelText('Kind'), 'item');
  await waitFor(() => expect(galleryCalls().at(-1)).toContain('kind=item'));
  await waitFor(() => expect(screen.queryByAltText('Caption 49')).toBeNull());
  expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
});

it('reads the photo day in the pinned time zone', () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(360);
});
