import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { DRAWERS } from '../../client/src/components/Cabinet.jsx';

beforeEach(() => {
  global.fetch = vi.fn(async url => new Response(JSON.stringify(
    url === '/api/health' ? { ok: true, demo: false } : { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' },
  ), { status: 200 }));
});

const at = path => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

it('has the eleven drawers in order', () => {
  expect(DRAWERS.map(d => d.label)).toEqual([
    'Today', 'Calendar', 'To-do', 'Herb cabinet', 'Grimoire', 'Recipe book',
    'Batch journal', 'Journal', 'Labels', 'Shopping list', 'Garden log',
  ]);
});

it('shows every drawer and marks the open one', async () => {
  at('/grimoire');
  const nav = await screen.findByRole('navigation', { name: 'Cabinet drawers' });
  const links = within(nav).getAllByRole('link');
  expect(links.map(l => l.textContent.trim())).toEqual(DRAWERS.map(d => d.label));
  expect(within(nav).getByRole('link', { name: 'Grimoire' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
});

it('opens a drawer that is not built yet with a friendly note', async () => {
  at('/garden');
  expect(await screen.findByRole('heading', { level: 1, name: 'Garden log' })).toBeInTheDocument();
  expect(screen.getByText(/being built/i)).toBeInTheDocument();
});

it('shows a not-found page for unknown paths', async () => {
  at('/nowhere');
  expect(await screen.findByRole('heading', { name: /lost in the stacks/i })).toBeInTheDocument();
});
