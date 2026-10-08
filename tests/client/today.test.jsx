import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';

let settings;
beforeEach(() => {
  settings = { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };
  global.fetch = vi.fn(async url => new Response(JSON.stringify(url === '/api/health' ? { ok: true, demo: false } : settings), { status: 200 }));
});
const today = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);

it('greets the keeper by name when one is set', async () => {
  settings.keeper_name = 'Stephanie';
  today();
  expect(await screen.findByRole('heading', { level: 1, name: /good (morning|afternoon|evening), stephanie/i })).toBeInTheDocument();
});

it('greets without a name when none is set', async () => {
  today();
  expect(await screen.findByRole('heading', { level: 1, name: /^good (morning|afternoon|evening)$/i })).toBeInTheDocument();
});

it('shows the three cabinet cards with gentle empty notes', async () => {
  today();
  for (const name of ['Batches due', 'Running low', 'Nearing expiry']) {
    expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
  }
  expect(screen.getAllByText(/once the herb cabinet is stocked/i)).toHaveLength(3);
});

it('has a wax seal button to log a batch', async () => {
  today();
  expect(await screen.findByRole('button', { name: /log a batch/i })).toBeInTheDocument();
});

it('moves from morning to afternoon without a reload', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 11, 58, 0));
  try {
    today();
    expect(await screen.findByRole('heading', { level: 1, name: 'Good morning' })).toBeInTheDocument();
    await act(async () => { vi.setSystemTime(new Date(2026, 9, 8, 12, 1, 0)); await vi.advanceTimersByTimeAsync(61000); });
    expect(screen.getByRole('heading', { level: 1, name: 'Good afternoon' })).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
