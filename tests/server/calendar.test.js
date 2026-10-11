process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { makeTestContext } from './helpers.js';
import { skyFacts } from '../../server/lib/sky.js';
import { repos } from '../../server/db/repos.js';
import { seedTimingRules } from '../../server/services/timing.js';

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
  expect(d).toEqual({ day: '2026-10-01', phase: f.phase.name, sign: f.moon.sign, ruler: f.ruler, festival: f.festival, marker: null, garden: expect.any(Array) });
  const markerOf = day => res.body.days.find(x => x.day === day).marker;
  expect(markerOf('2026-10-03')).toBe('last quarter');
  expect(markerOf('2026-10-10')).toBe('new');
  expect(markerOf('2026-10-18')).toBe('first quarter');
  expect(markerOf('2026-10-25')).toBe('full');
  expect(res.body.days.filter(x => x.marker)).toHaveLength(4);
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

it('uses her hemisphere for festival names', async () => {
  t = makeTestContext();
  expect((await get('from=2026-10-31&to=2026-10-31')).body.days[0].festival).toBe('Samhain');
  await t.http().put('/api/settings').send({ hemisphere: 'south' });
  expect((await get('from=2026-10-31&to=2026-10-31')).body.days[0].festival).toBe('Beltane');
});

it('leaves expiry auto tasks out of the task events', async () => {
  t = makeTestContext();
  const jar = await addItem({ name: 'Rose', expires_on: '2026-10-25' });
  const res = await get('from=2026-10-01&to=2026-10-31');
  const keys = t.ctx.db.prepare('SELECT auto_key FROM tasks').all().map(r => r.auto_key);
  expect(keys).toContain(`expiry:${jar.id}:2026-10-25`);
  expect(res.body.events.filter(e => e.title.includes('Rose'))).toMatchObject([{ kind: 'expiry', day: '2026-10-25' }]);
});

const day = d => t.http().get(`/api/calendar/day/${d}`);

it('returns one day with the sky, folk suggestions and its events', async () => {
  t = makeTestContext();
  await t.http().post('/api/timing-rules').send({ kind: 'festival', value: 'Samhain', text: 'Honour the ancestors.', weight: 3 });
  await t.http().post('/api/tasks').send({ title: 'Light a candle', due_on: '2026-10-31', today: TODAY });
  await t.http().post('/api/tasks').send({ title: 'Other day', due_on: '2026-10-30', today: TODAY });
  const res = await day('2026-10-31');
  expect(res.status).toBe(200);
  expect(res.body.sky).toMatchObject({ day: '2026-10-31', festival: 'Samhain' });
  expect(res.body.sky.phase).toBeTruthy();
  expect(res.body.suggestions).toEqual([{ id: expect.any(Number), text: 'Honour the ancestors.' }]);
  expect(res.body.events.map(e => e.title)).toEqual(['Light a candle']);
  expect(res.body.events[0]).toMatchObject({ kind: 'task', day: '2026-10-31', done: false, overdue: false });
});

it('returns no suggestions when sky suggestions are off, and the sky still shows', async () => {
  t = makeTestContext();
  await t.http().post('/api/timing-rules').send({ kind: 'festival', value: 'Samhain', text: 'Honour the ancestors.' });
  await t.http().put('/api/settings').send({ sky_suggestions: 'off' });
  const res = await day('2026-10-31');
  expect(res.body.suggestions).toEqual([]);
  expect(res.body.sky.festival).toBe('Samhain');
});

it('shows garden entries and expected harvests, with no duplicate harvest task event', async () => {
  t = makeTestContext();
  const p = (await t.http().post('/api/garden/plants').send({ name: 'Calendula', expected_harvest_on: '2026-10-14' })).body;
  const ended = (await t.http().post('/api/garden/plants').send({ name: 'Basil', expected_harvest_on: '2026-10-15', ended_on: '2026-10-01' })).body;
  const e = (await t.http().post('/api/garden/entries').send({ plant_id: p.id, kind: 'pruned', entry_date: '2026-10-12' })).body;
  const gone = (await t.http().post('/api/garden/entries').send({ plant_id: p.id, kind: 'pruned', entry_date: '2026-10-13' })).body;
  await t.http().delete(`/api/garden/entries/${gone.id}`);
  const res = await get('from=2026-10-01&to=2026-10-31');
  const ev = res.body.events;
  expect(ev.filter(x => x.kind === 'garden')).toEqual([{
    kind: 'garden', day: '2026-10-12', title: 'Pruned Calendula', link: `/garden/entries/${e.id}`, done: false, overdue: false, id: e.id,
  }]);
  expect(ev.filter(x => x.kind === 'harvest')).toEqual([
    { kind: 'harvest', day: '2026-10-14', title: 'Harvest Calendula', link: `/garden/plants/${p.id}`, done: false, overdue: false, id: p.id },
  ]);
  expect(ev.some(x => x.id === ended.id && x.kind === 'harvest')).toBe(false);
  const keys = t.ctx.db.prepare('SELECT auto_key FROM tasks').all().map(r => r.auto_key);
  expect(keys).toContain(`harvest:${p.id}:2026-10-14`);
  expect(ev.filter(x => x.title === 'Harvest Calendula')).toHaveLength(1);
});

it('orders events step, task, expiry, harvest, garden, journal on one day', async () => {
  t = makeTestContext();
  const p = (await t.http().post('/api/garden/plants').send({ name: 'Calendula', expected_harvest_on: '2026-10-12' })).body;
  await t.http().post('/api/garden/entries').send({ plant_id: p.id, kind: 'observed', entry_date: '2026-10-12' });
  await t.http().post('/api/tasks').send({ title: 'Task', due_on: '2026-10-12', today: TODAY });
  await addItem({ name: 'Rose', expires_on: '2026-10-12' });
  await addBatch([{ title: 'Strain', due_on: '2026-10-12' }]);
  const jt = repos(t.ctx.db).journalTypes.create({ name: 'Note', icon: 'pen', sort_order: 0 });
  await t.http().post('/api/journal').send({ type_id: jt.id, title: 'Note', entry_date: '2026-10-12' });
  const res = await day('2026-10-12');
  expect(res.body.events.map(x => x.kind)).toEqual(['step', 'task', 'expiry', 'harvest', 'garden', 'journal']);
});

it('adds the garden task keys to each day and the reasons to the day page', async () => {
  t = makeTestContext();
  seedTimingRules(t.ctx.db);
  const res = await get('from=2026-10-24&to=2026-10-26');
  const full = res.body.days.find(x => x.day === '2026-10-25');
  expect(full.garden).toContain('harvest-above');
  expect(res.body.days.every(x => Array.isArray(x.garden))).toBe(true);
  const d = (await day('2026-10-25')).body;
  const above = d.garden.find(x => x.task === 'harvest-above');
  expect(above.reasons.length).toBeGreaterThan(0);
  await t.http().put('/api/settings').send({ sky_suggestions: 'off' });
  expect((await day('2026-10-25')).body.garden).toEqual([]);
  expect((await get('from=2026-10-24&to=2026-10-26')).body.days.every(x => x.garden.length === 0)).toBe(true);
});

it('runs the auto task sync and flags overdue for a past day', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: '2026-10-05' }]);
  const res = await day('2026-10-05');
  expect(res.body.events).toMatchObject([{ kind: 'step', title: 'Strain: Oil', overdue: true, id: batch.steps[0].id }]);
});

it('passes now to the sky only for today', async () => {
  t = makeTestContext();
  const now = new Date(2026, 9, 10, 12, 0, 0);
  const a = (await day(TODAY)).body.sky;
  const past = (await day('2026-10-05')).body.sky;
  // Today counts from the current moment; another day counts from its own noon.
  expect(new Date(a.next_new) > now).toBe(true);
  expect(past.next_new).not.toBe(a.next_new);
  expect(new Date(past.next_new) > new Date(2026, 9, 5, 12, 0, 0)).toBe(true);
});

it('validates the day', async () => {
  t = makeTestContext();
  expect((await day('nope')).status).toBe(400);
  expect((await day('1899-12-31')).status).toBe(400);
  expect((await day('2026-02-30')).status).toBe(400);
});

it('lists journal entries as events and skips deleted ones', async () => {
  t = makeTestContext();
  const type = (await t.http().post('/api/journal-types').send({ name: 'Ritual' })).body;
  const make = title => t.http().post('/api/journal').send({ type_id: type.id, title, entry_date: '2026-10-12' }).then(r => r.body);
  const a = await make('Full moon rite');
  const b = await make('Gone');
  await t.http().delete(`/api/journal/${b.id}`);
  const res = await get('from=2026-10-01&to=2026-10-31');
  const ev = res.body.events.filter(e => e.kind === 'journal');
  expect(ev).toEqual([{ kind: 'journal', day: '2026-10-12', title: 'Full moon rite', link: `/journal/${a.id}`, done: false, overdue: false, id: a.id }]);
});
