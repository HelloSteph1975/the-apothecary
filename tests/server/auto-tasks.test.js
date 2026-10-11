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

// Garden harvest reminders ------------------------------------------------

const addPlant = async body => (await t.http().post('/api/garden/plants').send({ name: 'Calendula', ...body })).body;
const harvestKeys = () => keys().filter(k => k?.startsWith('harvest:'));

it('makes a harvest task 7 days before the expected date and not 8', async () => {
  t = makeTestContext();
  const near = await addPlant({ name: 'Calendula', expected_harvest_on: '2026-10-17' });
  await addPlant({ name: 'Sage', expected_harvest_on: '2026-10-18' });
  syncAutoTasks(t.ctx.db, TODAY);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([`harvest:${near.id}:2026-10-17`]);
  expect(all()[0]).toMatchObject({ kind: 'auto', title: 'Harvest Calendula', due_on: '2026-10-17', related_type: 'garden_plant', related_id: near.id });
  const [row] = await today('upcoming');
  expect(row.related).toEqual({ type: 'garden_plant', id: near.id, name: 'Calendula', live: true });
});

it('swaps the harvest task when the expected date changes', async () => {
  t = makeTestContext();
  const p = await addPlant({ expected_harvest_on: '2026-10-12' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([`harvest:${p.id}:2026-10-12`]);
  await t.http().patch(`/api/garden/plants/${p.id}`).send({ expected_harvest_on: '2026-10-15' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([`harvest:${p.id}:2026-10-15`]);
});

it('removes the harvest task when the plant ends or is deleted, and undo brings it back', async () => {
  t = makeTestContext();
  const p = await addPlant({ expected_harvest_on: '2026-10-12' });
  syncAutoTasks(t.ctx.db, TODAY);
  await t.http().patch(`/api/garden/plants/${p.id}`).send({ ended_on: '2026-10-09' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([]);
  await t.http().patch(`/api/garden/plants/${p.id}`).send({ ended_on: null });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toHaveLength(1);
  await t.http().delete(`/api/garden/plants/${p.id}`);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([]);
  await t.http().post(`/api/garden/plants/${p.id}/restore`);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toHaveLength(1);
});

it('stops the harvest task once a harvest is logged within 14 days of the expected date', async () => {
  t = makeTestContext();
  const p = await addPlant({ expected_harvest_on: '2026-10-12' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toHaveLength(1);
  const early = (await t.http().post('/api/garden/entries').send({ plant_id: p.id, kind: 'harvested', entry_date: '2026-09-27' })).body;
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toHaveLength(1);
  await t.http().delete(`/api/garden/entries/${early.id}`);
  const ok = (await t.http().post('/api/garden/entries').send({ plant_id: p.id, kind: 'harvested', entry_date: '2026-09-28' })).body;
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([]);
  await t.http().delete(`/api/garden/entries/${ok.id}`);
  await t.http().post('/api/garden/entries').send({ plant_id: p.id, kind: 'pruned', entry_date: '2026-10-09' });
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toHaveLength(1);
});

it('a dismissed harvest task stays gone', async () => {
  t = makeTestContext();
  await addPlant({ expected_harvest_on: '2026-10-12' });
  const [row] = await today('upcoming');
  await t.http().post(`/api/tasks/${row.id}/dismiss`).send({ today: TODAY });
  expect(await today('upcoming')).toHaveLength(0);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(harvestKeys()).toEqual([]);
});

it('renames an open harvest task when the plant is renamed, and leaves other tasks alone', async () => {
  t = makeTestContext();
  const p = await addPlant({ name: 'Calendula', expected_harvest_on: '2026-10-12' });
  const manual = (await t.http().post('/api/tasks').send({ title: 'Harvest Calendula', due_on: TODAY })).body;
  syncAutoTasks(t.ctx.db, TODAY);
  await t.http().patch(`/api/garden/plants/${p.id}`).send({ name: 'Pot marigold' });
  syncAutoTasks(t.ctx.db, TODAY);
  const titles = all().map(r => r.title);
  expect(titles).toContain('Harvest Pot marigold');
  expect(all().find(r => r.id === manual.id).title).toBe('Harvest Calendula');
  expect(harvestKeys()).toHaveLength(1);
});

it('keeps a harvest title she edited through a sync and a rename, but renames the default title', async () => {
  t = makeTestContext();
  const a = await addPlant({ name: 'Calendula', expected_harvest_on: '2026-10-12' });
  const b = await addPlant({ name: 'Sage', expected_harvest_on: '2026-10-12' });
  syncAutoTasks(t.ctx.db, TODAY);
  const mine = all().find(r => r.auto_key.startsWith(`harvest:${b.id}:`));
  t.ctx.db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run('Cut the sage before frost', mine.id);
  syncAutoTasks(t.ctx.db, TODAY);
  expect(all().find(r => r.id === mine.id).title).toBe('Cut the sage before frost');
  await t.http().patch(`/api/garden/plants/${a.id}`).send({ name: 'Pot marigold' });
  await t.http().patch(`/api/garden/plants/${b.id}`).send({ name: 'Garden sage' });
  const titles = all().map(r => r.title).sort();
  expect(titles).toEqual(['Cut the sage before frost', 'Harvest Pot marigold']);
});

it('retitles a finished harvest task on rename, so reopening it shows the new name, and keeps a custom title', async () => {
  t = makeTestContext();
  const a = await addPlant({ name: 'Calendula', expected_harvest_on: '2026-10-12' });
  const b = await addPlant({ name: 'Sage', expected_harvest_on: '2026-10-12' });
  syncAutoTasks(t.ctx.db, TODAY);
  const ta = all().find(r => r.auto_key.startsWith(`harvest:${a.id}:`));
  const tb = all().find(r => r.auto_key.startsWith(`harvest:${b.id}:`));
  t.ctx.db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run('Cut the sage before frost', tb.id);
  await t.http().post(`/api/tasks/${ta.id}/complete`).send({ today: TODAY });
  await t.http().post(`/api/tasks/${tb.id}/complete`).send({ today: TODAY });
  await t.http().patch(`/api/garden/plants/${a.id}`).send({ name: 'Pot marigold' });
  await t.http().patch(`/api/garden/plants/${b.id}`).send({ name: 'Garden sage' });
  await t.http().post(`/api/tasks/${ta.id}/uncomplete`);
  await t.http().post(`/api/tasks/${tb.id}/uncomplete`);
  expect(all().find(r => r.id === ta.id).title).toBe('Harvest Pot marigold');
  expect(all().find(r => r.id === tb.id).title).toBe('Cut the sage before frost');
});
