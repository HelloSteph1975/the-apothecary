import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

let saved;
let calls;
beforeEach(() => {
  saved = { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push(`${opts.method ?? 'GET'} ${url}`);
    const json = body => new Response(JSON.stringify(body), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings' && opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if (body.latitude === '99') return new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { latitude: 'Not a valid value' } }), { status: 400 });
      saved = { ...saved, ...body };
      return json(saved);
    }
    if (url === '/api/settings') return json(saved);
    if (url === '/api/backups' && opts.method === 'POST') return new Response(JSON.stringify({ name: 'apothecary-2026-10-08.db' }), { status: 201 });
    if (url === '/api/backups') return json([{ name: 'apothecary-2026-10-07.db', size: 4096, modified: '2026-10-07T21:30:00.000Z' }]);
    if (url === '/api/data-folder') return json({ path: 'C:\\Users\\me\\Documents\\The Apothecary Data' });
    return json({});
  });
});

const open = () => render(
  <ToastProvider><ConfirmProvider>
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />
  </ConfirmProvider></ToastProvider>,
);

it('saves the keeper name and location', async () => {
  const user = userEvent.setup();
  open();
  const name = await screen.findByLabelText('Your name');
  await user.type(name, 'Stephanie');
  await user.clear(screen.getByLabelText('Place name'));
  await user.type(screen.getByLabelText('Place name'), 'Oaxaca');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() => expect(saved).toMatchObject({ keeper_name: 'Stephanie', location_name: 'Oaxaca' }));
});

it('shows the server error next to the field', async () => {
  const user = userEvent.setup();
  open();
  const lat = await screen.findByLabelText('Latitude');
  await user.clear(lat);
  await user.type(lat, '99');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByText('Not a valid value')).toBeInTheDocument();
  expect(lat).toHaveAttribute('aria-invalid', 'true');
});

it('lists backups, backs up now, and shows the data folder', async () => {
  const user = userEvent.setup();
  open();
  expect(await screen.findByText('apothecary-2026-10-07.db')).toBeInTheDocument();
  expect(screen.getByText(/The Apothecary Data/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back up now' }));
  await waitFor(() => expect(calls).toContain('POST /api/backups'));
});

it('asks before restoring', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Restore apothecary-2026-10-07.db' }));
  expect(await screen.findByText(/safety copy/i)).toBeInTheDocument();
  expect(calls).not.toContain('POST /api/backups/restore');
});

it('says when backups could not load and lets her try again', async () => {
  const user = userEvent.setup();
  const base = global.fetch;
  let failing = true;
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (url === '/api/backups' && (opts.method ?? 'GET') === 'GET') {
      calls.push('GET /api/backups');
      return failing
        ? new Response(JSON.stringify({ error: 'Backups folder is unavailable.' }), { status: 500 })
        : new Response(JSON.stringify([]), { status: 200 });
    }
    return base(url, opts);
  });
  open();
  expect(await screen.findByText(/Couldn't load your backups\. Backups folder is unavailable\./)).toBeInTheDocument();
  const before = calls.filter(c => c === 'GET /api/backups').length;
  failing = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No backups yet.')).toBeInTheDocument();
  expect(calls.filter(c => c === 'GET /api/backups').length).toBe(before + 1);
});
