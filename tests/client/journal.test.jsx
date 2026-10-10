import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { skyStampText, entryWhen } from '../../client/src/lib/journal.jsx';

const Y = new Date().getFullYear();
const DAY = `${Y}-10-10`;
const weekday = new Date(Y, 9, 10).toLocaleDateString('en-US', { weekday: 'long' });
const entry = (id, over = {}) => ({
  id, title: `Entry ${id}`, entry_date: DAY, entry_time: '21:30', type: { id: 1, name: 'Ritual', icon: 'sparkles' }, mood: null,
  excerpt: `Body of ${id}`, tags: ['rose'], sky: { phase: 'waxing gibbous', sign: 'Taurus', ruler: 'Venus', festival: null }, cover: null, ...over,
});
let calls;
let respond;
beforeEach(() => {
  calls = [];
  respond = () => ({ entries: [], total: 0, page: 1 });
  global.fetch = vi.fn(async url => {
    calls.push(url);
    const json = b => new Response(JSON.stringify(b), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url.startsWith('/api/journal?')) {
      const p = new URL(url, 'http://x').searchParams;
      const view = p.get('view') || 'list';
      const r = respond(p);
      // Like the real API: the list view returns only entries, total and page.
      const own = view === 'list' ? { entries: r.entries, total: r.total, page: r.page } : r;
      return json({ view, ...own });
    }
    return json({});
  });
});
const open = (path = '/journal') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};
const journalCalls = () => calls.filter(c => c.startsWith('/api/journal?'));

it('writes the sky stamp and the date', () => {
  const sky = { phase: 'waxing gibbous', sign: 'Taurus', ruler: 'Venus', festival: null };
  expect(skyStampText(sky, '2026-10-09')).toBe('Waxing gibbous in Taurus, Friday under Venus');
  expect(skyStampText({ ...sky, festival: 'Samhain' }, '2026-10-09')).toBe('Waxing gibbous in Taurus, Friday under Venus, Samhain');
  expect(skyStampText({ ...sky, phase: 'full', sign: 'Aries' }, '2026-10-09')).toBe('Full moon in Aries, Friday under Venus');
  expect(skyStampText({ ...sky, phase: 'new', sign: 'Pisces' }, '2026-10-09')).toBe('New moon in Pisces, Friday under Venus');
  expect(entryWhen('2026-10-10', '21:30', new Date(2026, 5, 1))).toBe('Oct 10, 9:30 PM');
  expect(entryWhen('2026-10-10', null, new Date(2026, 5, 1))).toBe('Oct 10');
  expect(entryWhen('2025-10-10', '00:05', new Date(2026, 5, 1))).toBe('Oct 10, 2025, 12:05 AM');
});

it('shows entries as cards with the sky stamp, excerpt and tags', async () => {
  respond = () => ({ entries: [entry(1)], total: 1, page: 1 });
  open();
  expect(await screen.findByRole('heading', { level: 1, name: 'Journal' })).toBeInTheDocument();
  expect(screen.getByText('Rituals, moons, dreams and notes')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Write an entry' })).toHaveAttribute('href', '/journal/new');
  expect(screen.getByRole('link', { name: 'Photos' })).toHaveAttribute('href', '/journal/photos');
  expect(screen.getByRole('link', { name: 'Entry types' })).toHaveAttribute('href', '/journal/types');
  const link = await screen.findByRole('link', { name: 'Entry 1' });
  expect(link).toHaveAttribute('href', '/journal/1');
  const card = within(link.closest('.journal-card'));
  expect(card.getByText('Ritual')).toBeInTheDocument();
  expect(card.getByText('Oct 10, 9:30 PM')).toBeInTheDocument();
  expect(card.getByText(`Waxing gibbous in Taurus, ${weekday} under Venus`)).toBeInTheDocument();
  expect(card.getByText('Body of 1')).toBeInTheDocument();
  expect(card.getByText('rose')).toBeInTheDocument();
});

it('shows the empty state with a link to write the first entry', async () => {
  open();
  expect(await screen.findByText('Your journal is empty.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Write the first entry.' })).toHaveAttribute('href', '/journal/new');
});

it('says no entries match for a search with no results', async () => {
  open('/journal?q=zzz');
  expect(await screen.findByText('No entries match.')).toBeInTheDocument();
  expect(journalCalls().at(-1)).toBe('/api/journal?view=list&q=zzz');
});

it('sends a debounced search to the API and keeps it in the URL', async () => {
  const user = userEvent.setup();
  respond = () => ({ entries: [entry(1)], total: 1, page: 1 });
  const router = open();
  await screen.findByRole('link', { name: 'Entry 1' });
  await user.type(screen.getByLabelText('Search'), 'rose');
  await waitFor(() => expect(router.state.location.search).toBe('?q=rose'));
  await waitFor(() => expect(journalCalls().at(-1)).toBe('/api/journal?view=list&q=rose'));
  expect(journalCalls().filter(c => c.includes('q=')).length).toBe(1);
});

it('loads the next page with More entries and hides the button at the end', async () => {
  const user = userEvent.setup();
  respond = p => (p.get('page') === '2' ? { entries: [entry(31)], total: 31, page: 2 }
    : { entries: Array.from({ length: 30 }, (_, i) => entry(i + 1)), total: 31, page: 1 });
  open();
  await screen.findByRole('link', { name: 'Entry 1' });
  await user.click(screen.getByRole('button', { name: 'More entries' }));
  expect(await screen.findByRole('link', { name: 'Entry 31' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Entry 1' })).toBeInTheDocument();
  expect(calls).toContain('/api/journal?view=list&page=2');
  expect(screen.queryByRole('button', { name: 'More entries' })).toBeNull();
});

it('keeps the view in the URL and groups by type', async () => {
  const user = userEvent.setup();
  respond = p => ({
    view: 'type',
    types: [{ id: 1, name: 'Ritual', icon: 'sparkles', count: 2 }, { id: 2, name: 'Dream', icon: 'cloud', count: 1 }],
    ...(p.get('type_id') === '2' ? { entries: [entry(5, { title: 'A dream' })], total: 1, page: 1 } : { entries: [], total: 0, page: 1 }),
  });
  const router = open();
  await screen.findByRole('heading', { level: 1, name: 'Journal' });
  await user.click(screen.getByRole('link', { name: 'By type' }));
  expect(router.state.location.search).toBe('?view=type');
  expect(await screen.findByRole('button', { name: /Ritual\s*\(2\)/ })).toBeInTheDocument();
  expect(screen.getByText('Pick a type to see its entries.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Dream\s*\(1\)/ }));
  expect(await screen.findByRole('link', { name: 'A dream' })).toBeInTheDocument();
  expect(router.state.location.search).toBe('?view=type&type_id=2');
  expect(journalCalls().at(-1)).toBe('/api/journal?view=type&type_id=2');
});

it('switches from All to By type and By tag without breaking', async () => {
  const user = userEvent.setup();
  respond = p => {
    const view = p.get('view');
    if (view === 'type') return { types: [{ id: 1, name: 'Ritual', icon: 'sparkles', count: 1 }], entries: [], total: 0, page: 1 };
    if (view === 'tag') return { tags: [{ tag: 'rose', count: 1 }], entries: [], total: 0, page: 1 };
    return { entries: [entry(1)], total: 1, page: 1 };
  };
  open();
  await screen.findByRole('link', { name: 'Entry 1' });
  await user.click(screen.getByRole('link', { name: 'By type' }));
  expect(await screen.findByRole('button', { name: /Ritual\s*\(1\)/ })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'By tag' }));
  expect(await screen.findByRole('button', { name: /rose\s*\(1\)/ })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'All' }));
  expect(await screen.findByRole('link', { name: 'Entry 1' })).toBeInTheDocument();
});

it('resets paging when the search changes and hides More entries while loading', async () => {
  const user = userEvent.setup();
  let release;
  respond = p => (p.get('q') === 'moon'
    ? { entries: [entry(50, { title: 'Moon entry' })], total: 40, page: 1 }
    : { entries: Array.from({ length: 30 }, (_, i) => entry(i + 1)), total: 31, page: 1 });
  open();
  await screen.findByRole('link', { name: 'Entry 1' });
  const base = global.fetch.getMockImplementation();
  const gate = new Promise(r => { release = r; });
  global.fetch.mockImplementation(async (url, ...rest) => { if (url.includes('q=moon')) await gate; return base(url, ...rest); });
  await user.type(screen.getByLabelText('Search'), 'moon');
  await waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u.includes('q=moon'))).toBe(true));
  expect(screen.queryByRole('button', { name: 'More entries' })).toBeNull();
  release();
  expect(await screen.findByRole('link', { name: 'Moon entry' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Entry 1' })).toBeNull();
  expect(screen.getByRole('button', { name: 'More entries' })).toBeInTheDocument();
  expect(calls.some(c => c.includes('page=2'))).toBe(false);
});

it('groups by tag as plain chips with counts', async () => {
  const user = userEvent.setup();
  respond = p => ({
    view: 'tag', tags: [{ tag: 'rose', count: 3 }, { tag: 'yarrow', count: 1 }],
    ...(p.get('tag') === 'rose' ? { entries: [entry(7, { title: 'Rose night' })], total: 1, page: 1 } : { entries: [], total: 0, page: 1 }),
  });
  open('/journal?view=tag');
  await user.click(await screen.findByRole('button', { name: /rose\s*\(3\)/ }));
  expect(await screen.findByRole('link', { name: 'Rose night' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /yarrow\s*\(1\)/ })).toBeInTheDocument();
  expect(journalCalls().at(-1)).toBe('/api/journal?view=tag&tag=rose');
});

it('groups by moon with four groups, each with its count and entries', async () => {
  respond = p => {
    const groups = [{ group: 'new', count: 0 }, { group: 'waxing', count: 2 }, { group: 'full', count: 1 }, { group: 'waning', count: 0 }];
    const g = p.get('phase_group');
    if (!g) return { view: 'moon', groups, entries: [], total: 0, page: 1 };
    const n = g === 'waxing' ? 2 : 1;
    return { view: 'moon', groups, entries: Array.from({ length: n }, (_, i) => entry(g === 'waxing' ? i + 1 : 9, { title: `${g} ${i}` })), total: n, page: 1 };
  };
  open('/journal?view=moon');
  expect(await screen.findByRole('heading', { level: 2, name: /New moon\s*\(0\)/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: /Waxing\s*\(2\)/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: /Full moon\s*\(1\)/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: /Waning\s*\(0\)/ })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'waxing 1' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'full 0' })).toBeInTheDocument();
  expect(journalCalls()).toContain('/api/journal?view=moon&phase_group=full');
  expect(journalCalls()).not.toContain('/api/journal?view=moon&phase_group=new');
});

it('shows the empty state when no moon group has entries', async () => {
  respond = () => ({ view: 'moon', groups: ['new', 'waxing', 'full', 'waning'].map(group => ({ group, count: 0 })), entries: [], total: 0, page: 1 });
  open('/journal?view=moon');
  expect(await screen.findByText('Your journal is empty.')).toBeInTheDocument();
});
