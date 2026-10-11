import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { todayString } from '../../client/src/lib/today.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const TYPES = [{ id: 1, name: 'Ritual', icon: 'sparkles' }, { id: 2, name: 'Dream', icon: 'cloud' }];
const existing = {
  id: 4, title: 'Samhain night', type_id: 1, entry_date: '2026-10-31', entry_time: '21:30', mood: 'calm',
  body: 'Lit the candles.', type: TYPES[0], sky: {}, links: [{ type: 'herb', id: 3, name: 'Mugwort', live: true }],
  tags: ['samhain'], photos: [],
};
let calls;
let router;
let fail;
let slow;
let typesFail;
let editEntry;
beforeEach(() => {
  calls = [];
  fail = null;
  slow = null;
  typesFail = false;
  editEntry = null;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body });
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === '/api/journal-types') return typesFail ? json({ error: 'The types would not load.' }, 500) : json(TYPES);
    if (url === '/api/journal/tags') return json([{ tag: 'samhain', count: 2 }, { tag: 'moon', count: 1 }]);
    if (url === '/api/herbs') return json([{ id: 3, common_name: 'Mugwort' }, { id: 6, common_name: 'Yarrow' }]);
    if (url === '/api/recipes') return json([{ id: 5, name: 'Dream oil' }]);
    if (url === '/api/garden/entries/options') return json([{ id: 12, title: 'Harvested Calendula', entry_date: '2026-10-05' }]);
    if (url === '/api/batches') return json([{ id: 8, name: 'Autumn salve' }]);
    if (method === 'POST' && url === '/api/journal') {
      if (slow) await slow;
      if (fail) return json(fail.body, fail.status);
      return json({ ...existing, id: 9 }, 201);
    }
    if (method === 'PATCH' && url === '/api/journal/4') {
      if (fail) return json(fail.body, fail.status);
      return json(existing);
    }
    if (url === '/api/journal/9') return json({ ...existing, id: 9 });
    if (url === '/api/journal/4') return json(editEntry ?? existing);
    return json({});
  });
});
const open = async path => {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  await screen.findByRole('heading', { level: 1 });
  await screen.findByLabelText(/^Title/);
};
const saved = () => calls.filter(c => c.method === 'POST' || c.method === 'PATCH');
const links = () => screen.getByRole('list', { name: 'Linked records' });

it('starts a new entry on today with the required fields marked', async () => {
  await open('/journal/new');
  expect(screen.getByRole('heading', { level: 1, name: 'Add a journal entry' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title (required)')).toHaveValue('');
  expect(screen.getByLabelText('Type (required)')).toHaveValue('');
  expect(screen.getByLabelText('Date')).toHaveValue(todayString());
  expect(screen.getByLabelText('Time')).toHaveValue('');
  expect(within(screen.getByLabelText('Mood')).getAllByRole('option').map(o => o.textContent)).toContain('Curious');
});

it('shows the server errors for a missing title and type inline', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  fail = { status: 400, body: { error: 'Please fix the highlighted fields.', details: { title: 'Add a title', type_id: 'Choose a type for the entry' } } };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Add a title')).toHaveAttribute('role', 'alert');
  expect(screen.getByText('Choose a type for the entry')).toHaveAttribute('role', 'alert');
  expect(screen.getByLabelText('Title (required)')).toHaveAttribute('aria-invalid', 'true');
  expect(router.state.location.pathname).toBe('/journal/new');
});

it('saves a new entry with the body shape, goes to the entry and says Saved', async () => {
  const user = userEvent.setup();
  await open('/journal/new?date=2026-10-31');
  await user.type(screen.getByLabelText('Title (required)'), '  Moon walk ');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-31');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal/9'));
  expect(saved()).toEqual([{
    method: 'POST', url: '/api/journal',
    body: { title: 'Moon walk', type_id: 1, entry_date: '2026-10-31', entry_time: null, mood: null, body: null, tags: [], links: [] },
  }]);
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

it('adds tags with Enter and comma, removes them with the button, and suggests existing ones', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  const tags = screen.getByLabelText('Tags');
  const options = [...document.querySelectorAll(`datalist[id="${tags.getAttribute('list')}"] option`)].map(o => o.getAttribute('value'));
  expect(options).toEqual(['samhain', 'moon']);
  await user.type(tags, 'Dream work{Enter}');
  await user.type(tags, 'owl,');
  await user.type(tags, 'moon{Enter}');
  expect(tags).toHaveValue('');
  expect(screen.getByText('dream work')).toBeInTheDocument();
  expect(screen.getByText('owl')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove tag owl' }));
  expect(screen.queryByText('owl')).toBeNull();
  await user.type(tags, 'moon{Enter}');
  expect(screen.getAllByText('moon')).toHaveLength(1);
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Dream');
  await user.type(tags, 'last');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body.tags).toEqual(['dream work', 'moon', 'last']);
});

it('adds and removes linked records', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  await user.selectOptions(screen.getByLabelText('Link to'), 'Recipe');
  await user.selectOptions(screen.getByLabelText('Record'), 'Dream oil');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.selectOptions(screen.getByLabelText('Link to'), 'Herb');
  await user.selectOptions(screen.getByLabelText('Record'), 'Yarrow');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.selectOptions(screen.getByLabelText('Link to'), 'Batch');
  await user.selectOptions(screen.getByLabelText('Record'), 'Autumn salve');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(within(links()).getAllByRole('listitem')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: 'Remove link to Yarrow' }));
  expect(within(links()).getAllByRole('listitem')).toHaveLength(2);
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body.links).toEqual([{ type: 'recipe', id: 5 }, { type: 'batch', id: 8 }]);
});

it('does not add the same link twice', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  for (let i = 0; i < 2; i += 1) {
    await user.selectOptions(screen.getByLabelText('Record'), 'Mugwort');
    await user.click(screen.getByRole('button', { name: 'Add' }));
  }
  expect(within(links()).getAllByRole('listitem')).toHaveLength(1);
});

it('prefills the type, a herb and a batch from the link', async () => {
  await open('/journal/new?type=2&herb=6&batch=8');
  expect(screen.getByLabelText('Type (required)')).toHaveValue('2');
  expect(within(links()).getByText('Yarrow')).toBeInTheDocument();
  expect(within(links()).getByText('Autumn salve')).toBeInTheDocument();
});

it('ignores prefills that do not match anything', async () => {
  await open('/journal/new?type=99&herb=99&date=nope');
  expect(screen.getByLabelText('Type (required)')).toHaveValue('');
  expect(screen.queryByRole('list', { name: 'Linked records' })).toBeNull();
  expect(screen.getByLabelText('Date')).toHaveValue(todayString());
});

it('shows server errors inline, including a bad link, and stays on the form', async () => {
  const user = userEvent.setup();
  await open('/journal/new?herb=6');
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  fail = { status: 400, body: { error: 'Please fix the highlighted fields.', details: { entry_time: 'Use a time like 14:30', 'links.0': "That herb doesn't exist" } } };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Use a time like 14:30')).toHaveAttribute('role', 'alert');
  expect(screen.getByText("That herb doesn't exist")).toHaveAttribute('role', 'alert');
  expect(router.state.location.pathname).toBe('/journal/new');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

it('sends only one request on a double click of Save', async () => {
  const user = userEvent.setup();
  let release;
  slow = new Promise(r => { release = r; });
  await open('/journal/new');
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  await user.dblClick(screen.getByRole('button', { name: 'Save' }));
  release();
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal/9'));
  expect(saved()).toHaveLength(1);
});

it('asks before leaving with unsaved changes', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Leave' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal'));
});

it('does not ask when leaving after a save', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal/9'));
  expect(screen.queryByText('Leave without saving?')).toBeNull();
});

it('fills the edit form from the entry and saves changes with PATCH', async () => {
  const user = userEvent.setup();
  await open('/journal/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Title (required)')).toHaveValue('Samhain night'));
  expect(screen.getByLabelText('Type (required)')).toHaveValue('1');
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-31');
  expect(screen.getByLabelText('Time')).toHaveValue('21:30');
  expect(screen.getByLabelText('Mood')).toHaveValue('calm');
  expect(screen.getByLabelText('Body')).toHaveValue('Lit the candles.');
  expect(screen.getByText('samhain')).toBeInTheDocument();
  expect(within(links()).getByText('Mugwort')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Time'));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/journal/4'));
  expect(saved()[0]).toEqual({
    method: 'PATCH', url: '/api/journal/4',
    body: { title: 'Samhain night', type_id: 1, entry_date: '2026-10-31', entry_time: null, mood: 'calm', body: 'Lit the candles.', tags: ['samhain'], links: [{ type: 'herb', id: 3 }] },
  });
});

it('shows an error with Try again when the types will not load', async () => {
  const user = userEvent.setup();
  typesFail = true;
  router = createMemoryRouter(routes, { initialEntries: ['/journal/new'] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('The types would not load.');
  typesFail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByLabelText('Title (required)')).toBeInTheDocument();
});

it('titles the tag card, limits tag length and says how many tags fit', async () => {
  await open('/journal/new');
  expect(screen.getByText('Tags to find it again')).toBeInTheDocument();
  const tags = screen.getByLabelText('Tags');
  expect(tags).toHaveAttribute('maxlength', '40');
  expect(screen.getByText(/Up to 20 tags, 40 characters each./)).toBeInTheDocument();
});

it('treats Moon and moon as the same tag', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  const tags = screen.getByLabelText('Tags');
  await user.type(tags, 'Moon{Enter}');
  await user.type(tags, 'moon{Enter}');
  expect(within(screen.getByRole('list', { name: 'Tags added' })).getAllByRole('listitem')).toHaveLength(1);
});

it('moves focus to the tag input after removing a tag, and to the Record select after removing a link', async () => {
  const user = userEvent.setup();
  await open('/journal/new?herb=6');
  const tags = screen.getByLabelText('Tags');
  await user.type(tags, 'owl{Enter}');
  await user.click(screen.getByRole('button', { name: 'Remove tag owl' }));
  expect(tags).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Remove link to Yarrow' }));
  expect(screen.getByLabelText('Record')).toHaveFocus();
});

it('says a linked record is gone and does not send it', async () => {
  const user = userEvent.setup();
  editEntry = { ...existing, links: [...existing.links, { type: 'recipe', id: 5, name: 'Dream oil', live: false }] };
  await open('/journal/4/edit');
  expect(screen.getByText('A record this entry linked to is gone, so it was left out.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body.links).toEqual([{ type: 'herb', id: 3 }]);
});

it('sends the body as typed, and null only when it is empty', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  await user.type(screen.getByLabelText('Title (required)'), 'T');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  await user.type(screen.getByLabelText('Body'), '  Line one{Enter}  indented  ');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body.body).toBe('  Line one' + String.fromCharCode(10) + '  indented  ');
});

it('links a garden entry from the options list and sends it as garden_entry', async () => {
  const user = userEvent.setup();
  await open('/journal/new');
  await user.type(screen.getByLabelText('Title (required)'), 'Harvest day');
  await user.selectOptions(screen.getByLabelText('Type (required)'), 'Ritual');
  await user.selectOptions(screen.getByLabelText('Link to'), 'Garden entry');
  await user.selectOptions(screen.getByLabelText('Record'), 'Harvested Calendula');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(within(links()).getByText(/Harvested Calendula/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved()).toHaveLength(1));
  expect(saved()[0].body.links).toEqual([{ type: 'garden_entry', id: 12 }]);
  expect(calls.some(c => c.url === '/api/garden/entries/options')).toBe(true);
});
