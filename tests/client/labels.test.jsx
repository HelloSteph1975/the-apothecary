import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { LABEL_SIZES } from '../../server/services/labelSizes.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const ITEMS = [
  { id: 1, name: 'Calendula', latin_name: 'Calendula officinalis', section_id: 1, section_name: 'Herbs', section_kind: 'herb', amount: 40, unit: 'g', used_up_at: null },
  { id: 2, name: 'Lavender', latin_name: 'Lavandula angustifolia', section_id: 1, section_name: 'Herbs', section_kind: 'herb', amount: 30, unit: 'g', used_up_at: null },
  { id: 5, name: 'Beeswax', latin_name: null, section_id: 2, section_name: 'Supplies', section_kind: 'supply', amount: 100, unit: 'g', used_up_at: null },
];
const BATCHES = [
  { id: 3, name: 'Calendula oil, Oct 1', recipe_id: 7, recipe_name: 'Calendula oil', type_name: 'Infused oil', start_date: '2026-10-01', finished_on: '2026-10-20', cover: null, next_step: null },
  { id: 4, name: 'Lavender salve', recipe_id: null, recipe_name: null, type_name: 'Salve', start_date: '2026-10-05', finished_on: null, cover: null, next_step: null },
];
const DATA = {
  'item:1': { source: { kind: 'item', id: 1 }, name: 'Calendula', latin_name: 'Calendula officinalis', made_on: '2026-10-11', phase: 'waxing crescent', expires_on: '2027-04-11', ingredients: null, caution: 'Check cautions for Calendula before use.' },
  'item:2': { source: { kind: 'item', id: 2 }, name: 'Lavender', latin_name: 'Lavandula angustifolia', made_on: null, phase: null, expires_on: null, ingredients: null, caution: null },
  'batch:3': { source: { kind: 'batch', id: 3 }, name: 'Calendula oil, Oct 1', latin_name: null, made_on: '2026-10-01', phase: 'waning crescent', expires_on: '2027-04-20', ingredients: 'Calendula, Olive oil', caution: 'For skin only.' },
};
const FILES = [
  { name: 'labels-2026-10-11-101500.pdf', size: 3072, saved_at: '2026-10-11T17:15:00.000Z' },
];

let calls, router, pdfReply, filesReply, dataFail;
beforeEach(() => {
  calls = [];
  pdfReply = () => ({ file: 'labels-2026-10-11-120000.pdf', pages: 1, labels: 2 });
  filesReply = () => FILES;
  dataFail = false;
  window.print = vi.fn();
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/labels/sizes') return json(LABEL_SIZES);
    if (url.startsWith('/api/labels/data')) {
      if (dataFail) return json({ error: 'Could not load the labels.' }, 500);
      const q = new URLSearchParams(url.split('?')[1]);
      const ids = k => (q.get(k) ? q.get(k).split(',') : []);
      return json([...ids('items').map(i => DATA[`item:${i}`]), ...ids('batches').map(i => DATA[`batch:${i}`])].filter(Boolean));
    }
    if (url === '/api/labels/pdf' && method === 'POST') {
      const out = pdfReply();
      return out instanceof Response ? out : json(out);
    }
    if (url === '/api/labels/files') return json(filesReply());
    if (url.startsWith('/api/items?')) return json(ITEMS);
    if (url.startsWith('/api/batches')) return json(BATCHES);
    return json({ keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' });
  });
});

async function open(path) {
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  await screen.findByRole('heading', { level: 1, name: 'Labels' });
}
const pdfCalls = () => calls.filter(c => c.url === '/api/labels/pdf');
const group = name => screen.findByRole('group', { name: `Settings for ${name}` });

it('shows the header, the pick lists and the empty message', async () => {
  await open('/labels');
  expect(screen.getByText('Jars and batches, ready for the shelf')).toBeInTheDocument();
  expect(await screen.findByRole('checkbox', { name: 'Calendula' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Calendula oil, Oct 1' })).toBeInTheDocument();
  expect(screen.getByText('Pick jars or batches to make labels.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Supplies' })).toBeInTheDocument();
});

it('lists batches newest first', async () => {
  await open('/labels');
  await screen.findByRole('checkbox', { name: 'Lavender salve' });
  const names = within(screen.getByRole('group', { name: 'Batches' })).getAllByRole('checkbox').map(c => c.closest('label').textContent.trim());
  expect(names).toEqual(['Lavender salve', 'Calendula oil, Oct 1']);
});

it('filters each list by name', async () => {
  const user = userEvent.setup();
  await open('/labels');
  await screen.findByRole('checkbox', { name: 'Calendula' });
  await user.type(screen.getByLabelText('Find a jar'), 'lav');
  expect(screen.queryByRole('checkbox', { name: 'Calendula' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Lavender' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Calendula oil, Oct 1' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('Find a batch'), 'zzz');
  expect(screen.getByText('No batches match.')).toBeInTheDocument();
});

it('keeps the picks in the URL', async () => {
  const user = userEvent.setup();
  await open('/labels');
  await user.click(await screen.findByRole('checkbox', { name: 'Calendula' }));
  await user.click(screen.getByRole('checkbox', { name: 'Lavender' }));
  await user.click(screen.getByRole('checkbox', { name: 'Calendula oil, Oct 1' }));
  expect(router.state.location.search).toBe('?items=1%2C2&batches=3');
  await user.click(screen.getByRole('checkbox', { name: 'Calendula' }));
  expect(router.state.location.search).toBe('?items=2&batches=3');
  await waitFor(() => expect(calls.some(c => c.url === '/api/labels/data?items=2&batches=3')).toBe(true));
});

it('opens with the picks from the URL and prefills the label text', async () => {
  await open('/labels?items=1&batches=3');
  const cal = await group('Calendula');
  expect(within(cal).getByLabelText('Name')).toHaveValue('Calendula');
  expect(within(cal).getByLabelText('Latin name')).toHaveValue('Calendula officinalis');
  expect(within(cal).getByLabelText('Ingredients')).toHaveValue('');
  expect(within(cal).getByLabelText('Caution')).toHaveValue('Check cautions for Calendula before use.');
  expect(within(cal).getByLabelText('Copies')).toHaveValue(1);
  expect(within(cal).getByLabelText('Show the moon')).toBeChecked();
  const oil = await group('Calendula oil, Oct 1');
  expect(within(oil).getByLabelText('Ingredients')).toHaveValue('Calendula, Olive oil');
  expect(screen.getByRole('checkbox', { name: 'Calendula' })).toBeChecked();
  expect(calls.some(c => c.url === '/api/labels/data?items=1&batches=3')).toBe(true);
});

it('says so when nothing is picked and does not ask for label data', async () => {
  await open('/labels');
  await screen.findByRole('checkbox', { name: 'Calendula' });
  expect(calls.some(c => c.url.startsWith('/api/labels/data'))).toBe(false);
  expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save as PDF' })).toBeNull();
});

it('edits the label text and Reset brings it back', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1');
  const cal = await group('Calendula');
  const name = within(cal).getByLabelText('Name');
  await user.clear(name);
  await user.type(name, 'Marigold');
  expect(within(screen.getByTestId('label-card')).getByText('Marigold')).toBeInTheDocument();
  await user.click(within(cal).getByRole('button', { name: 'Reset' }));
  expect(within(cal).getByLabelText('Name')).toHaveValue('Calendula');
  expect(within(screen.getByTestId('label-card')).getByText('Calendula')).toBeInTheDocument();
});

it('shows only the fields the size has, with line clamps', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1&batches=3&size=large-rect');
  await screen.findAllByTestId('label-card');
  const [cal, oil] = screen.getAllByTestId('label-card');
  expect(within(cal).getByText('Calendula officinalis')).toBeInTheDocument();
  expect(within(cal).getByText('Made Oct 11, 2026')).toBeInTheDocument();
  expect(within(cal).getByText('Use by Apr 11, 2027')).toBeInTheDocument();
  expect(within(oil).getByText('Calendula, Olive oil')).toHaveAttribute('data-lines', '4');
  expect(within(oil).getByText('For skin only.')).toHaveAttribute('data-lines', '2');
  expect(within(cal).getByText('Calendula')).toHaveAttribute('data-lines', '2');
  expect(cal).toHaveClass('label-card');

  await user.selectOptions(screen.getByLabelText('Size'), 'medium-rect');
  const [mcal, moil] = screen.getAllByTestId('label-card');
  expect(within(moil).getByText('Calendula, Olive oil')).toHaveAttribute('data-lines', '2');
  expect(within(moil).getByText('For skin only.')).toHaveAttribute('data-lines', '1');
  expect(within(mcal).getByText('Calendula officinalis')).toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('Size'), 'small-round');
  const [scal, soil] = screen.getAllByTestId('label-card');
  expect(scal).toHaveAttribute('data-shape', 'circle');
  expect(within(scal).queryByText('Calendula officinalis')).toBeNull();
  expect(within(soil).queryByText('Calendula, Olive oil')).toBeNull();
  expect(within(soil).queryByText('For skin only.')).toBeNull();
  expect(within(soil).getByText('Use by Apr 20, 2027')).toBeInTheDocument();
  expect(router.state.location.search).toContain('size=small-round');
});

it('lists the three sizes with how many fit on a sheet', async () => {
  await open('/labels?items=1');
  await group('Calendula');
  const labels = within(screen.getByLabelText('Size')).getAllByRole('option').map(o => o.textContent);
  expect(labels).toEqual(['Small round, 12 per sheet', 'Medium rectangle, 10 per sheet', 'Large rectangle, 6 per sheet']);
});

it('draws copies in a row and leaves the slots before the start empty', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1&size=small-round');
  const cal = await group('Calendula');
  await user.clear(within(cal).getByLabelText('Copies'));
  await user.type(within(cal).getByLabelText('Copies'), '3');
  await user.clear(screen.getByLabelText('Start at label'));
  await user.type(screen.getByLabelText('Start at label'), '11');
  expect(screen.getAllByTestId('label-card')).toHaveLength(3);
  expect(screen.getAllByTestId('label-slot-empty')).toHaveLength(10);
  const sheets = screen.getAllByTestId('label-page');
  expect(sheets).toHaveLength(2);
  expect(within(sheets[0]).getAllByTestId('label-card')).toHaveLength(2);
  expect(within(sheets[1]).getAllByTestId('label-card')).toHaveLength(1);
  expect(within(sheets[0]).getAllByTestId('label-slot-empty')).toHaveLength(10);
});

it('shows the moon only when asked', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1');
  const cal = await group('Calendula');
  expect(screen.getByTestId('label-card').querySelector('.moon-glyph')).not.toBeNull();
  await user.click(within(cal).getByLabelText('Show the moon'));
  expect(screen.getByTestId('label-card').querySelector('.moon-glyph')).toBeNull();
});

it('prints through the browser', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1');
  await group('Calendula');
  await user.click(screen.getByRole('button', { name: 'Print' }));
  expect(window.print).toHaveBeenCalledTimes(1);
});

it('saves the PDF with her edits and says where it went', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1&batches=3&size=large-rect');
  const cal = await group('Calendula');
  await user.clear(within(cal).getByLabelText('Name'));
  await user.type(within(cal).getByLabelText('Name'), 'Marigold');
  await user.clear(within(cal).getByLabelText('Copies'));
  await user.type(within(cal).getByLabelText('Copies'), '2');
  await user.click(within(cal).getByLabelText('Show the moon'));
  await user.clear(screen.getByLabelText('Start at label'));
  await user.type(screen.getByLabelText('Start at label'), '3');
  await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
  expect(await screen.findByText('Saved labels-2026-10-11-120000.pdf in your labels folder.')).toBeInTheDocument();
  expect(pdfCalls()).toHaveLength(1);
  expect(pdfCalls()[0].body).toEqual({
    size: 'large-rect', start: 3,
    labels: [
      { name: 'Marigold', latin_name: 'Calendula officinalis', made_on: '2026-10-11', expires_on: '2027-04-11', ingredients: '', caution: 'Check cautions for Calendula before use.', show_moon: false, copies: 2 },
      { name: 'Calendula oil, Oct 1', latin_name: '', made_on: '2026-10-01', expires_on: '2027-04-20', ingredients: 'Calendula, Olive oil', caution: 'For skin only.', show_moon: true, copies: 1 },
    ],
  });
  expect(calls.filter(c => c.url === '/api/labels/files').length).toBeGreaterThanOrEqual(2);
});

it('shows a 400 inline and keeps the edits', async () => {
  const user = userEvent.setup();
  pdfReply = () => new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { 'labels.0.name': 'Required', start: 'Must be a whole number from 1 to 12' } }), { status: 400 });
  await open('/labels?items=1');
  const cal = await group('Calendula');
  await user.clear(within(cal).getByLabelText('Name'));
  await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
  expect(await screen.findByText('Please fix the highlighted fields.')).toHaveAttribute('role', 'alert');
  expect(within(cal).getByText('Required')).toBeInTheDocument();
  expect(screen.getByText('Must be a whole number from 1 to 12')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save as PDF' })).toBeEnabled();
});

it('shows the plain 500 message inline', async () => {
  const user = userEvent.setup();
  pdfReply = () => new Response(JSON.stringify({ error: "Couldn't save the PDF in the labels folder." }), { status: 500 });
  await open('/labels?items=1');
  await group('Calendula');
  await user.click(screen.getByRole('button', { name: 'Save as PDF' }));
  const alert = await screen.findByText("Couldn't save the PDF in the labels folder.");
  expect(alert).toHaveAttribute('role', 'alert');
});

it('sends only one PDF request on a double click', async () => {
  const user = userEvent.setup();
  let release;
  const slow = new Promise(r => { release = r; });
  const base = global.fetch;
  global.fetch = vi.fn(async (url, opts) => {
    if (url === '/api/labels/pdf') await slow;
    return base(url, opts);
  });
  await open('/labels?items=1');
  await group('Calendula');
  await user.dblClick(screen.getByRole('button', { name: 'Save as PDF' }));
  release();
  await screen.findByText(/Saved labels-.* in your labels folder/);
  expect(pdfCalls()).toHaveLength(1);
});

it('lists the saved PDFs with links that open in a new tab', async () => {
  await open('/labels');
  const link = await screen.findByRole('link', { name: 'labels-2026-10-11-101500.pdf' });
  expect(link).toHaveAttribute('href', '/api/labels/files/labels-2026-10-11-101500.pdf');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link.closest('li')).toHaveTextContent('3 KB');
});

it('says so when no sheets are saved yet', async () => {
  filesReply = () => [];
  await open('/labels');
  expect(await screen.findByText('No saved label sheets yet.')).toBeInTheDocument();
});

it('shows a load error with Try again', async () => {
  const user = userEvent.setup();
  dataFail = true;
  await open('/labels?items=1');
  expect(await screen.findByText('Could not load the labels.')).toHaveAttribute('role', 'alert');
  dataFail = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await group('Calendula');
});

it('asks before leaving with edits, but not after only picking', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1');
  const cal = await group('Calendula');
  await user.click(screen.getByRole('checkbox', { name: 'Lavender' }));
  expect(screen.queryByText('Leave without saving?')).toBeNull();
  await user.type(within(cal).getByLabelText('Name'), 'x');
  await user.click(screen.getByRole('checkbox', { name: 'Beeswax' }));
  expect(screen.queryByText('Leave without saving?')).toBeNull();
  await user.click(screen.getByRole('link', { name: 'Shopping list' }));
  expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Leave' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/shopping'));
});

it('leaves quietly when nothing was edited', async () => {
  const user = userEvent.setup();
  await open('/labels?items=1');
  await group('Calendula');
  await user.click(screen.getByRole('link', { name: 'Shopping list' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/shopping'));
});
