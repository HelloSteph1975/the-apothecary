process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { makeTestContext } from './helpers.js';
import { skyFacts } from '../../server/lib/sky.js';

let t;
// Only Date is faked, so the sync and the overdue flags see the same day the test uses.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); t?.cleanup(); });

const TODAY = '2026-10-10';
const get = q => t.http().get(`/api/calendar?${q}`);
const addItem = async body => (await t.http().post('/api/items').send({ section_id: 1, unit: 'g', name: 'Jar', amount: 50, ...body })).body;
const addBatch = async (steps, extra = {}) => (await t.http().post('/api/batches').send({ name: 'Oil', start_date: TODAY, steps, ...extra })).body;

it('returns a day per date with the sky and a marker on principal phases', async () => {
  t = makeTestContext();
  const res = await get('from=2026-10-01&to=2026-10-31');
  expect(res.status).toBe(200);
  expect(res.body.days).toHaveLength(31);
  const d = res.body.days[0];
  const f = skyFacts('2026-10-01');
  expect(d).toEqual({ day: '2026-10-01', phase: f.phase.name, sign: f.moon.sign, ruler: f.ruler, festival: f.festival, marker: null });
  const marked = res.body.days.filter(x => x.marker);
  expect(marked.map(x => x.marker).sort()).toEqual(expect.arrayContaining(['full', 'new']));
  for (const m of marked) expect(m.marker).toBe(m.phase);
  expect(res.body.days.filter(x => x.marker === 'full')).toHaveLength(1);
  expect(res.body.days.find(x => x.day === '2026-10-31').festival).toBe('Samhain');
});

it('lists steps, tasks and jar expiries with done and overdue flags', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: '2026-10-12' }, { title: 'Shake', due_on: '2026-10-05' }, { title: 'Rest', due_on: '2026-10-06' }]);
  await t.http().patch(`/api/batches/${batch.id}/steps/${batch.steps[2].id}`).send({ done_on: '2026-10-06' });
  const task = (await t.http().post('/api/tasks').send({ title: 'Water sage', due_on: '2026-10-08', today: TODAY })).body;
  const doneTask = (await t.http().post('/api/tasks').send({ title: 'Label jars', due_on: '2026-10-20', today: TODAY })).body;
  await t.http().post(`/api/tasks/${doneTask.id}/complete`).send({ today: TODAY });
  const jar = await addItem({ name: 'Rose', expires_on: '2026-10-25' });
  const used = await addItem({ name: 'Used', expires_on: '2026-10-26' });
  await t.http().patch(`/api/items/${used.id}`).send({ used_up: true });
  const res = await get('from=2026-10-01&to=2026-10-31');
  const ev = res.body.events;
  const step = ev.find(e => e.title === 'Strain: Oil');
  expect(step).toMatchObject({ kind: 'step', day: '2026-10-12', link: `/batches/${batch.id}`, done: false, overdue: false, id: batch.steps[0].id });
  expect(ev.find(e => e.title === 'Shake: Oil')).toMatchObject({ done: false, overdue: true });
  expect(ev.find(e => e.title === 'Rest: Oil')).toMatchObject({ done: true, overdue: false });
  expect(ev.find(e => e.title === 'Water sage')).toMatchObject({ kind: 'task', link: `/todo/${task.id}`, done: false, overdue: true });
  expect(ev.find(e => e.title === 'Label jars')).toMatchObject({ kind: 'task', done: true, overdue: false });
  expect(ev.find(e => e.kind === 'expiry' && e.id === jar.id)).toMatchObject({ day: '2026-10-25', link: `/cabinet/items/${jar.id}`, done: false, overdue: false });
  expect(ev.some(e => e.kind === 'expiry' && e.id === used.id)).toBe(false);
});

it('runs the auto task sync and does not repeat step tasks', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: '2026-10-12' }]);
  await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  const res = await get('from=2026-10-01&to=2026-10-31');
  const keys = t.ctx.db.prepare('SELECT auto_key FROM tasks').all().map(r => r.auto_key);
  expect(keys.some(k => k.startsWith('step:'))).toBe(true);
  expect(keys.some(k => k.startsWith('restock:'))).toBe(true);
  expect(res.body.events.filter(e => e.title === 'Strain: Oil')).toHaveLength(1);
  expect(res.body.events.filter(e => e.kind === 'task' && e.title.startsWith('Strain'))).toHaveLength(0);
  expect(res.body.events.find(e => e.title === 'Restock Sage')).toMatchObject({ kind: 'task', day: TODAY });
  expect(batch.steps).toHaveLength(1);
});

it('skips deleted batches and tasks, and shows the steps of a finished batch as done', async () => {
  t = makeTestContext();
  const gone = await addBatch([{ title: 'Gone', due_on: '2026-10-12' }]);
  await t.http().delete(`/api/batches/${gone.id}`);
  const fin = await addBatch([{ title: 'Left', due_on: '2026-10-13' }], { name: 'Finished' });
  await t.http().post(`/api/batches/${fin.id}/finish`).send({ finished_on: TODAY });
  const task = (await t.http().post('/api/tasks').send({ title: 'Bin me', due_on: '2026-10-14', today: TODAY })).body;
  await t.http().delete(`/api/tasks/${task.id}`);
  const res = await get('from=2026-10-01&to=2026-10-31');
  expect(res.body.events.filter(e => /Gone|Bin me/.test(e.title))).toEqual([]);
  expect(res.body.events.filter(e => e.title === 'Left: Finished')).toMatchObject([{ done: true, overdue: false }]);
});

it('validates the range', async () => {
  t = makeTestContext();
  let res = await get('from=2026-10-01&to=2026-12-01');
  expect(res.status).toBe(200);
  expect(res.body.days).toHaveLength(62);
  res = await get('from=2026-10-01&to=2026-12-02');
  expect(res.status).toBe(400);
  expect(res.body.details.to).toMatch(/62/);
  res = await get('from=2026-10-05&to=2026-10-01');
  expect(res.status).toBe(400);
  res = await get('from=2026-10-05');
  expect(res.status).toBe(400);
  res = await get('from=1899-12-31&to=1900-01-02');
  expect(res.status).toBe(400);
  res = await get('from=2026-10-01&from=2026-10-02&to=2026-10-03');
  expect(res.status).toBe(400);
});
