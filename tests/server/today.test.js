import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
// Only Date is faked, so the sync sees the same day the test uses.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 8, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); t?.cleanup(); });

it('summarises low, nearing and expired items and leaves batches empty', async () => {
  t = makeTestContext();
  const h = t.http;
  const add = body => h().post('/api/items').send({ section_id: 1, unit: 'g', ...body });
  await add({ name: 'Mullein', amount: 5, low_threshold: 20 });
  await add({ name: 'Yarrow', amount: 18, low_threshold: 20 });
  await add({ name: 'Rose', amount: 100, expires_on: '2026-10-20' });
  await add({ name: 'Elderberry', amount: 100, expires_on: '2026-11-07' });
  await add({ name: 'Hibiscus', amount: 100, expires_on: '2026-11-08' });
  await add({ name: 'Old sage', amount: 100, expires_on: '2026-10-07' });
  const used = (await add({ name: 'Gone', amount: 0, low_threshold: 5 })).body;
  await h().patch(`/api/items/${used.id}`).send({ used_up: true });
  const res = await h().get('/api/today?today=2026-10-08');
  expect(res.status).toBe(200);
  expect(res.body.runningLow.map(i => i.name)).toEqual(['Mullein', 'Yarrow']);
  expect(res.body.nearingExpiry.map(i => i.name)).toEqual(['Rose', 'Elderberry']);
  expect(res.body.expired.map(i => i.name)).toEqual(['Old sage']);
  expect(res.body.batchesDue).toEqual([]);
  expect(res.body.counts).toEqual({ runningLow: 2, nearingExpiry: 2, expired: 1, batchesDue: 0, tasks: 3 });
  expect(res.body.tasks.map(x => x.title)).toEqual(['Use or replace Old sage', 'Restock Mullein', 'Restock Yarrow']);
});

it('caps each list at eight but counts them all', async () => {
  t = makeTestContext();
  for (let i = 0; i < 10; i++) await t.http().post('/api/items').send({ section_id: 11, name: `Tin ${i}`, amount: 0, unit: 'count', low_threshold: 2 });
  const res = await t.http().get('/api/today?today=2026-10-08');
  expect(res.body.runningLow).toHaveLength(8);
  expect(res.body.counts.runningLow).toBe(10);
});

it('needs a date', async () => {
  t = makeTestContext();
  expect((await t.http().get('/api/today')).status).toBe(400);
});

it('lists today tasks, capped at eight, with a full count', async () => {
  t = makeTestContext();
  for (let i = 0; i < 10; i++) await t.http().post('/api/tasks').send({ title: `Task ${i}`, due_on: '2026-10-08', today: '2026-10-08' });
  await t.http().post('/api/tasks').send({ title: 'Later', due_on: '2026-10-09', today: '2026-10-08' });
  const res = await t.http().get('/api/today?today=2026-10-08');
  expect(res.body.tasks).toHaveLength(8);
  expect(res.body.counts.tasks).toBe(10);
});
