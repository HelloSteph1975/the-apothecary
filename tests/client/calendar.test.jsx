import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { addDaysTo } from '../../client/src/lib/tasks.js';
import { MoonGlyph } from '../../client/src/lib/moonGlyph.jsx';

const ev = (kind, day, title, extra = {}) => ({ kind, day, title, link: `/${kind}/1`, done: false, overdue: false, id: 1, ...extra });
const EVENTS = [
  ev('task', '2026-10-09', 'Water the sage', { link: '/todo/1', id: 1 }),
  ev('step', '2026-10-09', 'Strain: Oil', { link: '/batches/2', id: 2 }),
  ev('task', '2026-10-12', 'One', { id: 11 }), ev('task', '2026-10-12', 'Two', { id: 12 }), ev('task', '2026-10-12', 'Three', { id: 13 }),
  ev('step', '2026-10-12', 'Four: Oil', { id: 14 }), ev('expiry', '2026-10-12', 'Use up Rose', { id: 15 }),
  ev('step', '2026-10-20', 'Rest: Oil', { done: true, id: 20 }),
  ev('expiry', '2026-11-03', 'Use up Mint', { id: 30 }),
  ev('task', '2026-10-14', 'Late job', { overdue: true, id: 40 }),
];
let calls;
let location;
let events;
let hold;
beforeEach(() => {
  calls = [];
  events = EVENTS;
  hold = null;
  global.fetch = vi.fn(async url => {
    calls.push(url);
    const json = b => new Response(JSON.stringify(b), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    const m = /^\/api\/calendar\?from=([\d-]+)&to=([\d-]+)$/.exec(url);
    if (m) {
      if (hold && m[1] === '2026-11-01') await hold;
      const days = [];
      for (let d = m[1]; d <= m[2]; d = addDaysTo(d, 1)) {
        const full = d === '2026-10-26';
        days.push({
          day: d, phase: full ? 'full' : 'waxing crescent', sign: 'Scorpio', ruler: 'Venus',
          festival: d === '2026-10-31' ? 'Samhain' : null, marker: full ? 'full' : null,
        });
      }
      return json({ days, events: events.filter(e => e.day >= m[1] && e.day <= m[2]) });
    }
    return json({});
  });
});
const open = async path => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  location = () => router.state.location;
  render(<ToastProvider><ConfirmProvider><RouterProvider router={router} /></ConfirmProvider></ToastProvider>);
  await screen.findByRole('heading', { name: 'Calendar', level: 1 });
  await waitFor(() => expect(screen.queryByText('Opening the calendar...')).toBeNull());
};
const cell = name => screen.getByRole('link', { name });

it('draws a month grid starting on Sunday with labelled cells', async () => {
  await open('/calendar?view=month&date=2026-10-09');
  expect(screen.getByRole('heading', { name: 'Calendar', level: 1 })).toBeInTheDocument();
  expect(screen.getByText("The moon, the wheel, and what's due")).toBeInTheDocument();
  const heads = screen.getAllByRole('columnheader').map(h => h.textContent);
  expect(heads).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  expect(calls).toContain('/api/calendar?from=2026-09-27&to=2026-10-31');
  expect(screen.getAllByRole('row')).toHaveLength(6);
  const nine = cell('Friday, October 9: waxing crescent in Scorpio, 2 things due');
  expect(nine).toHaveAttribute('href', '/calendar/2026-10-09');
  expect(nine.closest('td')).toHaveTextContent('Scorpio');
  expect(nine.closest('td').querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  expect(within(nine.closest('td')).getByRole('link', { name: /Water the sage/ })).toHaveAttribute('href', '/todo/1');
  expect(cell(/^Saturday, October 31: .*Samhain/).closest('td')).toHaveTextContent('Samhain');
  expect(cell(/^Monday, October 26: full moon in Scorpio/).closest('td')).toHaveTextContent('Full moon');
  expect(cell(/^Sunday, September 27/).closest('td')).toHaveClass('is-outside');
});

it('shows three events and then "+N more"', async () => {
  await open('/calendar?view=month&date=2026-10-09');
  const td = cell(/^Monday, October 12/).closest('td');
  expect(within(td).getAllByRole('listitem')).toHaveLength(4);
  expect(within(td).queryByText('Four: Oil')).toBeNull();
  const more = within(td).getByRole('link', { name: '+2 more' });
  expect(more).toHaveAttribute('href', '/calendar/2026-10-12');
});

it('moves focus between days with the arrow keys', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  cell(/^Friday, October 9/).focus();
  await user.keyboard('{ArrowRight}');
  expect(cell(/^Saturday, October 10/)).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(cell(/^Saturday, October 17/)).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(cell(/^Friday, October 16/)).toHaveFocus();
  await user.keyboard('{ArrowUp}');
  expect(cell(/^Friday, October 9/)).toHaveFocus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(location().pathname).toBe('/calendar/2026-10-09'));
});

it('has one tab stop and ignores arrow keys with a modifier held', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  const stops = () => [...document.querySelectorAll('a[data-day]')].filter(a => a.getAttribute('tabindex') === '0');
  expect(stops()).toHaveLength(1);
  expect(stops()[0]).toHaveAttribute('data-day', '2026-10-09');
  cell(/^Friday, October 9/).focus();
  await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
  expect(cell(/^Friday, October 9/)).toHaveFocus();
  await user.keyboard('{ArrowRight}');
  expect(stops()).toHaveLength(1);
  expect(stops()[0]).toHaveAttribute('data-day', '2026-10-10');
});

it('carries the arrow keys into the next month from the end of the grid', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  cell(/^Saturday, October 31/).focus();
  await user.keyboard('{ArrowRight}');
  expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  expect(location().search).toContain('date=2026-11-01');
  await waitFor(() => expect(cell(/^Sunday, November 1:/)).toHaveFocus());
  await user.keyboard('{ArrowUp}');
  expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
  await waitFor(() => expect(cell(/^Sunday, October 25/)).toHaveFocus());
  cell(/^Wednesday, October 28/).focus();
  await user.keyboard('{ArrowDown}');
  expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  await waitFor(() => expect(cell(/^Wednesday, November 4/)).toHaveFocus());
});

it('does not pull focus into the grid after an abandoned cross-month move', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  let release;
  hold = new Promise(r => { release = r; });
  cell(/^Saturday, October 31/).focus();
  await user.keyboard('{ArrowRight}');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Opening the calendar...')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'Previous' }));
  release();
  expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Opening the calendar...')).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous' }));
});

it('crosses a month boundary inside the grid without leaving the page', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-08-15');
  cell(/^Monday, August 31/).focus();
  await user.keyboard('{ArrowRight}');
  expect(cell(/^Tuesday, September 1/)).toHaveFocus();
  expect(location().search).toContain('date=2026-08-15');
});

it('hides event kinds with the filters and keeps them in the URL', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  await user.click(screen.getByRole('checkbox', { name: 'Tasks' }));
  expect(location().search).toContain('hide=task');
  const td = cell(/^Friday, October 9/).closest('td');
  expect(td).not.toHaveTextContent('Water the sage');
  expect(td).toHaveTextContent('Strain: Oil');
  expect(cell('Friday, October 9: waxing crescent in Scorpio, 1 thing due')).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'Batch steps' }));
  expect(location().search).toContain('hide=step%2Ctask');
  await user.click(screen.getByRole('checkbox', { name: 'Jars to use up' }));
  expect(screen.getByRole('checkbox', { name: 'Jars to use up' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Tasks' }));
  expect(location().search).not.toContain('task');
});

it('reads the view, date and filters from the URL', async () => {
  await open('/calendar?view=month&date=2026-10-09&hide=step,expiry');
  expect(screen.getByRole('checkbox', { name: 'Tasks' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Batch steps' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Jars to use up' })).not.toBeChecked();
  expect(screen.queryByText('Strain: Oil')).toBeNull();
});

it('moves by month with Previous and Next, and back with Today', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  expect(location().search).toContain('date=2026-11-01');
  expect(calls).toContain('/api/calendar?from=2026-11-01&to=2026-12-05');
  await user.click(screen.getByRole('button', { name: 'Previous' }));
  await user.click(screen.getByRole('button', { name: 'Previous' }));
  expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Today' }));
  expect(location().search).not.toContain('date=');
});

it('switches between Month, Week and Agenda in the URL', async () => {
  const user = userEvent.setup();
  await open('/calendar?view=month&date=2026-10-09');
  await user.click(screen.getByRole('button', { name: 'Week' }));
  expect(location().search).toContain('view=week');
  expect(await screen.findByRole('heading', { name: 'Week of October 4' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Agenda' }));
  expect(location().search).toContain('view=agenda');
  await screen.findByRole('heading', { name: /Friday, October 9/ });
  await user.click(screen.getByRole('button', { name: 'Month' }));
  expect(location().search).toContain('view=month');
});

it('lists every event in the week view', async () => {
  await open('/calendar?view=week&date=2026-10-11');
  expect(calls).toContain('/api/calendar?from=2026-10-11&to=2026-10-17');
  const col = screen.getByRole('region', { name: /Monday, October 12/ });
  expect(within(col).getAllByRole('listitem')).toHaveLength(5);
  expect(within(col).queryByText(/more/)).toBeNull();
  expect(within(col).getByRole('link', { name: /Use up Rose/ })).toHaveAttribute('href', '/expiry/1');
  expect(screen.getByRole('region', { name: /Wednesday, October 14/ })).toHaveTextContent('Overdue');
  expect(screen.getAllByRole('region')).toHaveLength(7);
});

it('lists the next 30 days with events or markers in the agenda', async () => {
  await open('/calendar?view=agenda&date=2026-10-09');
  expect(calls).toContain('/api/calendar?from=2026-10-09&to=2026-11-07');
  const heads = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
  expect(heads).toEqual([
    expect.stringContaining('Friday, October 9'), expect.stringContaining('Monday, October 12'), expect.stringContaining('Wednesday, October 14'),
    expect.stringContaining('Tuesday, October 20'), expect.stringContaining('Monday, October 26'), expect.stringContaining('Saturday, October 31'),
    expect.stringContaining('Tuesday, November 3'),
  ]);
  expect(screen.getByText('Full moon')).toBeInTheDocument();
  expect(screen.getByText('Samhain')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Rest: Oil/ })).toBeInTheDocument();
});

it('says so when the agenda is empty', async () => {
  events = [];
  await open('/calendar?view=agenda&date=2026-12-01');
  expect(screen.getByText('Nothing planned in these 30 days.')).toBeInTheDocument();
});

it('draws a moon glyph for every phase and hides it from screen readers', () => {
  for (const phase of ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent']) {
    const { container, unmount } = render(<MoonGlyph phase={phase} size={20} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '20');
    unmount();
  }
});

it('shows blank cells and disables Previous at January 1900', async () => {
  await open('/calendar?view=month&date=1900-01-15');
  expect(calls).toContain('/api/calendar?from=1900-01-01&to=1900-02-03');
  expect(screen.getAllByRole('row')).toHaveLength(6);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: /December 31/ })).toBeNull();
  expect(screen.getAllByRole('link', { name: /^Monday, January 1:/ })).toHaveLength(1);
});

it('shows blank cells and disables Next at December 2100', async () => {
  await open('/calendar?view=month&date=2100-12-15');
  expect(calls).toContain('/api/calendar?from=2100-11-28&to=2100-12-31');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: /January 1, 2101|Friday, January 1/ })).toBeNull();
});
