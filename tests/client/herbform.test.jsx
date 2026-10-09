import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const herb = {
  id: 4, common_name: 'Yarrow', latin_name: 'Achillea millefolium', family: 'Asteraceae', is_starter: 1,
  other_names: ['Milfoil'], parts_used: ['leaf', 'flower'], preparations: ['tea blend'], zodiac: [], associations: [], garden_companions: ['Chamomile'],
  uses: 'Teas', ahpa_class: '1', planet: 'Venus', element: 'Water', gender: 'feminine',
  sources: [
    { title: 'First book', author: 'A', year: 2001, url: 'https://a.example', covers: ['uses'] },
    { title: 'Second book', author: null, year: null, url: null, covers: [] },
  ],
};

let calls;
let fail;
beforeEach(() => {
  calls = [];
  fail = null;
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (method !== 'GET' && fail) return json({ error: 'Please fix the highlighted fields.', details: fail }, 400);
    if (url === '/api/herbs' && method === 'POST') return json({ id: 9 }, 201);
    if (url === '/api/herbs/4') return json(herb);
    if (url === '/api/herbs/5') return json({ ...herb, id: 5, is_starter: 0, common_name: 'Mugwort', sources: [] });
    if (url === '/api/herbs/9') return json({ ...herb, id: 9, is_starter: 0, common_name: 'New' });
    return json({});
  });
});

const open = path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  return router;
};
const sent = () => calls.find(c => c.method !== 'GET')?.body;

it('requires a common name and marks it required', async () => {
  const user = userEvent.setup();
  open('/grimoire/new');
  const name = await screen.findByLabelText('Common name (required)');
  expect(name).toBeRequired();
  fail = { common_name: 'Required' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Required')).toBeInTheDocument();
});

it('sends arrays from comma text and checkboxes, trimmed', async () => {
  const user = userEvent.setup();
  const router = open('/grimoire/new');
  await user.type(await screen.findByLabelText('Common name (required)'), 'Mint');
  await user.type(screen.getByLabelText('Other names'), ' Spearmint, ,Garden mint ,');
  await user.click(screen.getByRole('checkbox', { name: 'Leaf' }));
  await user.click(screen.getByRole('checkbox', { name: 'Bulb' }));
  await user.click(screen.getByRole('checkbox', { name: 'Tea blend' }));
  await user.type(screen.getByLabelText('Zodiac signs'), 'Gemini,Virgo');
  await user.selectOptions(screen.getByLabelText('Planet'), 'Venus');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sent()).toMatchObject({
    common_name: 'Mint', other_names: ['Spearmint', 'Garden mint'], parts_used: ['leaf', 'bulb'],
    preparations: ['tea blend'], zodiac: ['Gemini', 'Virgo'], planet: 'Venus', ahpa_class: null, sources: [],
  }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/grimoire/9'));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

it('adds, removes and reorders sources and sends them in order', async () => {
  const user = userEvent.setup();
  open('/grimoire/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Yarrow'));
  await user.click(screen.getByRole('button', { name: 'Add source' }));
  const titles = screen.getAllByLabelText('Title (required)');
  expect(titles).toHaveLength(3);
  expect(titles[2]).toHaveFocus();
  await user.type(titles[2], 'Third book');
  await user.click(screen.getByRole('button', { name: 'Move source 2 up' }));
  await user.click(screen.getByRole('button', { name: 'Remove source 3' }));
  expect(screen.getByRole('button', { name: 'Remove source 2' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sent().sources.map(s => s.title)).toEqual(['Second book', 'First book']));
  expect(sent().sources[1]).toMatchObject({ author: 'A', year: 2001, url: 'https://a.example', covers: ['uses'] });
});

it('shows a source address error on that row', async () => {
  const user = userEvent.setup();
  open('/grimoire/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Yarrow'));
  fail = { 'sources.1.url': 'Enter a web address starting with https://' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const err = await screen.findByText('Enter a web address starting with https://');
  expect(err.closest('fieldset')).toHaveTextContent('Source 2');
});

it('shows the starter note when editing a starter herb only', async () => {
  open('/grimoire/4/edit');
  expect(await screen.findByText("This is one of the starter herbs. Your changes are kept and won't be overwritten.")).toBeInTheDocument();
});

it('has no starter note on a new herb', async () => {
  open('/grimoire/new');
  await screen.findByLabelText('Common name (required)');
  expect(screen.getByRole('heading', { level: 1, name: 'Add an herb' })).toBeInTheDocument();
  expect(screen.queryByText(/starter herbs/)).not.toBeInTheDocument();
});

it('asks before leaving a changed form', async () => {
  const user = userEvent.setup();
  open('/grimoire/new');
  await user.type(await screen.findByLabelText('Common name (required)'), 'x');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
});

it('clears every source error when the sources change', async () => {
  const user = userEvent.setup();
  open('/grimoire/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Yarrow'));
  fail = { 'sources.0.title': 'Required', 'sources.1.url': 'Enter a web address starting with https://', sources: 'Too many sources' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter a web address starting with https://')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove source 1' }));
  expect(screen.queryByText('Enter a web address starting with https://')).not.toBeInTheDocument();
  expect(screen.queryByText('Required')).not.toBeInTheDocument();
  expect(screen.queryByText('Too many sources')).not.toBeInTheDocument();
});

it('sends a year that is not a number as typed, so the server can flag it', async () => {
  const user = userEvent.setup();
  open('/grimoire/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Yarrow'));
  const year = screen.getAllByLabelText('Year')[1];
  await user.type(year, 'c. 1650');
  fail = { 'sources.1.year': 'Must be a number' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(sent().sources[1].year).toBe('c. 1650'));
  expect(sent().sources[0].year).toBe(2001);
  const err = await screen.findByText('Must be a number');
  expect(err.closest('fieldset')).toHaveTextContent('Source 2');
});

it('shows a covers error inside that source and a list error above the sources', async () => {
  const user = userEvent.setup();
  open('/grimoire/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Yarrow'));
  fail = { 'sources.0.covers': 'Pick from the list', sources: 'Too many sources' };
  await user.click(screen.getByRole('button', { name: 'Save' }));
  const covers = await screen.findByText('Pick from the list');
  expect(screen.getByRole('group', { name: 'Source 1 covers' })).toContainElement(covers);
  const listError = screen.getByText('Too many sources');
  const firstRow = screen.getAllByRole('group', { name: /^Source \d$/ })[0];
  expect(listError.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('loads the other herb when moving from one edit page to another', async () => {
  const router = open('/grimoire/4/edit');
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Yarrow'));
  await act(() => router.navigate('/grimoire/5/edit'));
  await waitFor(() => expect(screen.getByLabelText('Common name (required)')).toHaveValue('Mugwort'));
  expect(screen.getByRole('heading', { level: 1, name: 'Edit Mugwort' })).toBeInTheDocument();
  expect(screen.queryAllByLabelText('Title (required)')).toHaveLength(0);
});

it('sends one POST when Save is pressed twice quickly', async () => {
  const user = userEvent.setup();
  open('/grimoire/new');
  await user.type(await screen.findByLabelText('Common name (required)'), 'Sage');
  const save = screen.getByRole('button', { name: 'Save' });
  await user.dblClick(save);
  await waitFor(() => expect(calls.some(c => c.method === 'POST')).toBe(true));
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
});
