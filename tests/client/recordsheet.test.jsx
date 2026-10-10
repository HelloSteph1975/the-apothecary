import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

const base = {
  id: 5, name: 'Calendula oil, Oct 1', start_date: '2026-10-01', finished_on: '2026-10-20',
  base: 'Olive oil', intention: 'Soothe dry skin', method: 'Steeped in a warm window.', noticed: 'Golden color',
  would_change: 'Use less oil', label_notes: 'Keeps 6 months.', notes: null, expires_on: '2027-04-20',
  recipe: { id: 7, name: 'Calendula oil' }, type: { id: 2, name: 'Infused oil' },
  lines: [
    { id: 1, herb_id: 3, name: 'Calendula', amount: 40, unit: 'g' },
    { id: 2, herb_id: null, name: 'Olive oil', amount: 500, unit: 'ml' },
  ],
  steps: [], photos: [], status: 'finished',
};
const LABELS = ['Date', 'Recipe', 'Preparation type', 'Herbs used', 'Base', 'Why I made it', 'How I prepared it',
  'What I noticed', 'What I would change', 'Label and shelf-life notes'];

let batch;
beforeEach(() => {
  batch = JSON.parse(JSON.stringify(base));
  global.fetch = vi.fn(async url => new Response(JSON.stringify(url === '/api/batches/5' ? batch : {}), { status: 200 }));
});

function open() {
  const router = createMemoryRouter(routes, { initialEntries: ['/batches/5/sheet'] });
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
}

it('shows every field label in order', async () => {
  open();
  await screen.findByRole('heading', { name: 'Calendula oil, Oct 1' });
  const labels = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
  expect(labels).toEqual(LABELS);
});

it('shows the values', async () => {
  open();
  const sheet = await screen.findByTestId('record-sheet');
  const t = sheet.textContent;
  for (const v of ['Oct 1, 2026', 'Oct 20, 2026', 'Calendula oil', 'Infused oil', '40 g', 'Calendula', '500 ml', 'Olive oil',
    'Soothe dry skin', 'Steeped in a warm window.', 'Golden color', 'Use less oil', 'Keeps 6 months.', 'Apr 20, 2027']) {
    expect(t).toContain(v);
  }
  expect(sheet.querySelectorAll('.writing-lines')).toHaveLength(0);
});

it('draws ruled lines for empty fields', async () => {
  batch = { ...batch, noticed: null, would_change: null, lines: [], recipe: null, type: null };
  open();
  const sheet = await screen.findByTestId('record-sheet');
  const section = label => screen.getByRole('heading', { name: label }).closest('section');
  for (const l of ['Recipe', 'Preparation type', 'Herbs used', 'What I noticed', 'What I would change']) {
    expect(section(l).querySelector('.writing-lines')).not.toBeNull();
  }
  expect(section('Why I made it').querySelector('.writing-lines')).toBeNull();
  expect(sheet).toBeInTheDocument();
});

it('prints and links back', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  open();
  await screen.findByTestId('record-sheet');
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Back to the batch' })).toHaveAttribute('href', '/batches/5');
});

it('offers Try again when the batch will not load', async () => {
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'Nope' }), { status: 500 }));
  open();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument());
  expect(within(document.body).getByRole('alert')).toBeInTheDocument();
});

it('shows what was drawn from the jar when it differs from the recipe amount', async () => {
  batch.lines = [
    { id: 1, herb_id: 3, name: 'Calendula', amount: 30, unit: 'g', drawn_amount: 0.03, drawn_unit: 'kg', item: { id: 9, name: 'Calendula jar', live: true } },
    { id: 2, herb_id: null, name: 'Olive oil', amount: 500, unit: 'ml', drawn_amount: 500, drawn_unit: 'ml', item: { id: 10, name: 'Oil', live: true } },
    { id: 3, herb_id: null, name: 'Rose', amount: null, unit: null, drawn_amount: 5, drawn_unit: 'g', item: null },
  ];
  open();
  const sheet = await screen.findByTestId('record-sheet');
  const items = [...sheet.querySelectorAll('.sheet-herbs li')].map(li => li.textContent);
  expect(items[0]).toBe('30 g Calendula (0.03 kg drawn from Calendula jar)');
  expect(items[1]).toBe('500 ml Olive oil');
  expect(items[2]).toBe('5 g Rose');
});
