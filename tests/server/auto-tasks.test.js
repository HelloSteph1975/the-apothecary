import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { makeTestContext } from './helpers.js';
import { syncAutoTasks } from '../../server/services/tasks.js';

let t;
// Only Date is faked, so the sync sees the same day the test uses.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); t?.cleanup(); });

const TODAY = '2026-10-10';
const all = () => t.ctx.db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY id').all();
const keys = () => all().map(r => r.auto_key);
const addItem = async body => (await t.http().post('/api/items').send({ section_id: 1, unit: 'g', name: 'Jar', amount: 50, ...body })).body;
const addBatch = async steps => (await t.http().post('/api/batches').send({ name: 'Oil', start_date: TODAY, steps })).body;
const today = async (view = 'today') => (await t.http().get(`/api/tasks?view=${view}&today=${TODAY}`)).body;

it('makes a restock task for a low item and clears it when stocked', async () => {
  t = makeTestContext();
  const item = await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  syncAutoTasks(t.ctx.db, TODAY);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(all()).toHaveLength(1);
  expect(all()[0]).toMatchObject({ kind: 'auto', title: 'Restock Sage', due_on: TODAY, related_type: 'item', related_id: item.id, auto_key: `restock:${item.id}:0` });
  await t.http().patch(`/api/items/${item.id}`).send({ amount: 20 });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(all()).toHaveLength(0);
});

it('makes an expiry task within 30 days or when expired, cleared when it changes', async () => {
  t = makeTestContext();
  const a = await addItem({ name: 'Rose', expires_on: '2026-11-09' });
  const b = await addItem({ name: 'Old', expires_on: '2026-09-01' });
  await addItem({ name: 'Fine', expires_on: '2026-11-10' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(keys().sort()).toEqual([`expiry:${a.id}:2026-11-09`, `expiry:${b.id}:2026-09-01`].sort());
  expect(all().find(r => r.related_id === a.id)).toMatchObject({ title: 'Use or replace Rose', due_on: '2026-11-09' });
  await t.http().patch(`/api/items/${a.id}`).send({ expires_on: '2027-05-01' });
  await t.http().patch(`/api/items/${b.id}`).send({ used_up: true });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(all()).toHaveLength(0);
});

it('makes a step task for open steps due within 7 days, cleared on date change or finish', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: '2026-10-14' }, { title: 'Far', due_on: '2026-10-30' }]);
  syncAutoTasks(t.ctx.db, TODAY);
  const step = batch.steps[0];
  expect(keys()).toEqual([`step:${step.id}:2026-10-14`]);
  expect(all()[0]).toMatchObject({ title: 'Strain: Oil', due_on: '2026-10-14', related_type: 'batch', related_id: batch.id });
  await t.http().patch(`/api/batches/${batch.id}/steps/${step.id}`).send({ due_on: '2026-10-15' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(keys()).toEqual([`step:${step.id}:2026-10-15`]);
  await t.http().post(`/api/batches/${batch.id}/finish`).send({ finished_on: TODAY });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(all()).toHaveLength(0);
});

it('completing a step task marks the step done', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: TODAY }]);
  const rows = await today();
  expect(rows).toHaveLength(1);
  const res = await t.http().post(`/api/tasks/${rows[0].id}/complete`).send({ today: TODAY });
  expect(res.body.task.done_on).toBe(TODAY);
  const after = (await t.http().get(`/api/batches/${batch.id}`)).body;
  expect(after.steps[0].done_on).toBe(TODAY);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(all()).toHaveLength(1);
  expect(await today('done')).toHaveLength(1);
});

it('a done restock task is not recreated while the cause is unchanged', async () => {
  t = makeTestContext();
  await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  const [row] = await today();
  await t.http().post(`/api/tasks/${row.id}/complete`).send({ today: TODAY });
  expect(await today()).toHaveLength(0);
});

it('a dismissed restock stays away until the purchase count changes', async () => {
  t = makeTestContext();
  const item = await addItem({ name: 'Sage', amount: 2, low_threshold: 50 });
  const [row] = await today();
  const d = await t.http().post(`/api/tasks/${row.id}/dismiss`).send({ today: TODAY });
  expect(d.status).toBe(200);
  expect(await today()).toHaveLength(0);
  expect(t.ctx.db.prepare('SELECT auto_key FROM task_dismissals').all()).toEqual([{ auto_key: row.auto_key }]);
  const re = await t.http().post(`/api/items/${item.id}/restock`).send({ purchased_on: TODAY, quantity: 1 });
  expect(re.status).toBeLessThan(300);
  expect((await today()).map(r => r.auto_key)).toEqual([`restock:${item.id}:1`]);
});

it('a dismissed expiry returns when the expiry date changes', async () => {
  t = makeTestContext();
  const item = await addItem({ name: 'Rose', expires_on: '2026-10-20' });
  const [row] = await today('upcoming');
  await t.http().post(`/api/tasks/${row.id}/dismiss`).send({ today: TODAY });
  expect(await today('upcoming')).toHaveLength(0);
  await t.http().patch(`/api/items/${item.id}`).send({ expires_on: '2026-10-25' });
  expect((await today('upcoming')).map(r => r.auto_key)).toEqual([`expiry:${item.id}:2026-10-25`]);
});

it('an automatic task allows title, notes, priority and snooze but not its date or links', async () => {
  t = makeTestContext();
  await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  const [row] = await today();
  const bad = await t.http().patch(`/api/tasks/${row.id}`).send({ due_on: '2026-10-20' });
  expect(bad.status).toBe(400);
  expect(bad.body.details.due_on).toBeTruthy();
  expect((await t.http().patch(`/api/tasks/${row.id}`).send({ related_type: 'recipe', related_id: 1 })).status).toBe(400);
  const ok = await t.http().patch(`/api/tasks/${row.id}`)
    .send({ title: 'Buy sage', notes: 'organic', priority: 'high', snoozed_until: '2026-10-12', due_on: row.due_on });
  expect(ok.status).toBe(200);
  expect(ok.body).toMatchObject({ title: 'Buy sage', notes: 'organic', priority: 'high', snoozed_until: '2026-10-12' });
});

it('uncompleting a step task reopens the step and the task survives a sync', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: TODAY }]);
  const [row] = await today();
  await t.http().post(`/api/tasks/${row.id}/complete`).send({ today: TODAY });
  await t.http().post(`/api/tasks/${row.id}/uncomplete`).send({});
  expect((await t.http().get(`/api/batches/${batch.id}`)).body.steps[0].done_on).toBeNull();
  expect((await today()).map(r => r.id)).toEqual([row.id]);
});

it('a stale auto task with photos is finished, not deleted; without photos it is removed', async () => {
  t = makeTestContext();
  const a = await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  const b = await addItem({ name: 'Rue', amount: 2, low_threshold: 5 });
  syncAutoTasks(t.ctx.db, TODAY);
  const withPhoto = all().find(r => r.related_id === a.id);
  t.ctx.db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('task', ?, '1-abcdef12.jpg')").run(withPhoto.id);
  await t.http().patch(`/api/items/${a.id}`).send({ amount: 20 });
  await t.http().patch(`/api/items/${b.id}`).send({ amount: 20 });
  syncAutoTasks(t.ctx.db, TODAY);
  const left = all();
  expect(left).toHaveLength(1);
  expect(left[0]).toMatchObject({ id: withPhoto.id, done_on: TODAY });
  expect(t.ctx.db.prepare("SELECT deleted_at FROM photos WHERE owner_type = 'task' AND owner_id = ?").get(withPhoto.id).deleted_at).toBeNull();
});

it('only open automatic tasks can be dismissed', async () => {
  t = makeTestContext();
  await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  const [row] = await today();
  await t.http().post(`/api/tasks/${row.id}/complete`).send({ today: TODAY });
  const res = await t.http().post(`/api/tasks/${row.id}/dismiss`).send({ today: TODAY });
  expect(res.status).toBe(400);
  expect(res.body.error ?? res.body.message).toBe('This task is already done.');
});

it('sync trusts a day only within a day of the clock', async () => {
  t = makeTestContext();
  await addItem({ name: 'Sage', amount: 2, low_threshold: 5 });
  syncAutoTasks(t.ctx.db, '2030-01-01');
  expect(all()[0].due_on).toBe('2026-10-11');
});

it('reopening a step that was finished from the to-do list brings its reminder back', async () => {
  t = makeTestContext();
  const batch = await addBatch([{ title: 'Strain', due_on: TODAY }]);
  const [row] = await today();
  await t.http().post(`/api/tasks/${row.id}/complete`).send({ today: TODAY });
  const step = batch.steps[0];
  await t.http().patch(`/api/batches/${batch.id}/steps/${step.id}`).send({ done_on: null });
  syncAutoTasks(t.ctx.db, TODAY);
  const rows = await today();
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(row.id);
  expect(all()).toHaveLength(1);
});

it('a restock reminder is not hidden by an old dismissal after purchases are deleted', async () => {
  t = makeTestContext();
  const item = await addItem({ name: 'Sage', amount: 2, low_threshold: 500 });
  await t.http().post(`/api/items/${item.id}/restock`).send({ purchased_on: TODAY, quantity: 1 });
  const [row] = await today();
  expect(row.auto_key).toBe(`restock:${item.id}:1`);
  await t.http().post(`/api/tasks/${row.id}/dismiss`).send({ today: TODAY });
  t.ctx.db.prepare('UPDATE purchases SET deleted_at = ? WHERE item_id = ?').run(new Date().toISOString(), item.id);
  await t.http().post(`/api/items/${item.id}/restock`).send({ purchased_on: TODAY, quantity: 1 });
  expect((await today()).map(r => r.auto_key)).toEqual([`restock:${item.id}:2`]);
});
