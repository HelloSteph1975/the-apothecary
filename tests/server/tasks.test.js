import { it, expect, afterEach, beforeEach, vi } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
// Only Date is faked, so the sync sees the same day the test uses.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); t?.cleanup(); });

const TODAY = '2026-10-10';
const make = body => t.http().post('/api/tasks').send({ today: TODAY, ...body });
const list = async (view, today = TODAY) => (await t.http().get(`/api/tasks?view=${view}&today=${today}`)).body;
const titles = rows => rows.map(r => r.title);

it('today view: overdue first, then high priority, then title; hides snoozed and future', async () => {
  t = makeTestContext();
  await make({ title: 'B today', due_on: TODAY });
  await make({ title: 'A today', due_on: TODAY });
  await make({ title: 'Z high today', due_on: TODAY, priority: 'high' });
  await make({ title: 'Old', due_on: '2026-10-01', priority: 'low' });
  await make({ title: 'Future', due_on: '2026-10-11' });
  await make({ title: 'No date' });
  const snoozed = (await make({ title: 'Snoozed', due_on: TODAY })).body;
  await t.http().post(`/api/tasks/${snoozed.id}/snooze`).send({ until: '2026-10-12', today: TODAY });
  const rows = await list('today');
  expect(titles(rows)).toEqual(['Old', 'Z high today', 'A today', 'B today']);
  expect(rows[0].overdue).toBe(true);
  expect(rows[1].overdue).toBe(false);
  expect(rows[0]).toHaveProperty('related', null);
  expect(titles(await list('today', '2026-10-12'))).toContain('Snoozed');
});

it('upcoming view: due date first, no date last, snoozed shown with their date', async () => {
  t = makeTestContext();
  await make({ title: 'Later', due_on: '2026-11-01' });
  await make({ title: 'Soon', due_on: '2026-10-12' });
  await make({ title: 'Soon high', due_on: '2026-10-12', priority: 'high' });
  await make({ title: 'Someday' });
  await make({ title: 'Due now', due_on: TODAY });
  const s = (await make({ title: 'Snoozed', due_on: TODAY })).body;
  await t.http().post(`/api/tasks/${s.id}/snooze`).send({ until: '2026-10-15', today: TODAY });
  const rows = await list('upcoming');
  expect(titles(rows)).toEqual(['Soon high', 'Soon', 'Snoozed', 'Later', 'Someday']);
  expect(rows.find(r => r.title === 'Snoozed').snoozed_until).toBe('2026-10-15');
});

it('area view groups open tasks by related record', async () => {
  t = makeTestContext();
  const item = (await t.http().post('/api/items').send({ section_id: 1, unit: 'g', name: 'Mugwort', amount: 50 })).body;
  await make({ title: 'Check jar', related_type: 'item', related_id: item.id });
  await make({ title: 'Loose' });
  const g = await list('area');
  expect(Object.keys(g)).toEqual(['item', 'recipe', 'batch', 'herb', 'none']);
  expect(titles(g.item)).toEqual(['Check jar']);
  expect(g.item[0].related).toEqual({ type: 'item', id: item.id, name: 'Mugwort', live: true });
  expect(titles(g.none)).toEqual(['Loose']);
});

it('done view lists the most recent first and caps at 100', async () => {
  t = makeTestContext();
  for (let i = 0; i < 102; i++) {
    const row = (await make({ title: `T${i}` })).body;
    const day = String((i % 28) + 1).padStart(2, '0');
    await t.http().post(`/api/tasks/${row.id}/complete`).send({ today: `2026-${i < 51 ? '08' : '09'}-${day}` });
  }
  const rows = await list('done');
  expect(rows).toHaveLength(100);
  expect(rows.every((r, i) => i === 0 || rows[i - 1].done_on >= r.done_on)).toBe(true);
}, 30000);

it('rejects an unknown view and a missing date', async () => {
  t = makeTestContext();
  expect((await t.http().get('/api/tasks?view=nope&today=2026-10-10')).status).toBe(400);
  expect((await t.http().get('/api/tasks?view=today')).status).toBe(400);
});

it('a repeat without a due date gets today; monthly gets its anchor day', async () => {
  t = makeTestContext();
  const w = (await make({ title: 'Water', repeat_kind: 'daily' })).body;
  expect(w.due_on).toBe(TODAY);
  const m = (await make({ title: 'Rent', repeat_kind: 'monthly', due_on: '2026-10-31' })).body;
  expect(m.repeat_anchor_day).toBe(31);
  const p = (await t.http().patch(`/api/tasks/${m.id}`).send({ due_on: '2026-10-15' })).body;
  expect(p.repeat_anchor_day).toBe(15);
  const none = (await t.http().patch(`/api/tasks/${m.id}`).send({ repeat_kind: 'none' })).body;
  expect(none.repeat_anchor_day).toBeNull();
  const wk = (await make({ title: 'Sweep', repeat_kind: 'weekly', repeat_days: [1, 4] })).body;
  expect(wk.repeat_days).toEqual([1, 4]);
  const bad = await make({ title: 'x', repeat_kind: 'weekly', repeat_days: [9] });
  expect(bad.status).toBe(400);
  expect(bad.body.details.repeat_days).toBeTruthy();
});

it('checks the related record is live', async () => {
  t = makeTestContext();
  const r = await make({ title: 'x', related_type: 'item', related_id: 9999 });
  expect(r.status).toBe(400);
  expect(r.body.details.related_id).toBeTruthy();
  expect((await make({ title: 'x', related_type: 'batch' })).status).toBe(400);
  const gone = (await t.http().post('/api/items').send({ section_id: 1, unit: 'g', name: 'J', amount: 5 })).body;
  await t.http().delete(`/api/items/${gone.id}`);
  expect((await make({ title: 'x', related_type: 'item', related_id: gone.id })).status).toBe(400);
});

it('completing a repeat spawns the next task; uncompleting removes it', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', notes: 'ferns', due_on: TODAY, repeat_kind: 'daily', priority: 'high' })).body;
  const done = await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY });
  expect(done.status).toBe(200);
  expect(done.body.task.done_on).toBe(TODAY);
  expect(done.body.next).toMatchObject({ title: 'Water', notes: 'ferns', due_on: '2026-10-11', done_on: null, priority: 'high', repeat_kind: 'daily' });
  const un = await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  expect(un.body.done_on).toBeNull();
  expect((await t.http().get(`/api/tasks/${done.body.next.id}`)).status).toBe(404);
});

it('uncompleting leaves an edited next task alone', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', due_on: TODAY, repeat_kind: 'daily' })).body;
  const { next } = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body;
  await t.http().patch(`/api/tasks/${next.id}`).send({ title: 'Water well' });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  expect((await t.http().get(`/api/tasks/${next.id}`)).status).toBe(200);
});

it('monthly repeats keep the anchor day; no next for a one-off', async () => {
  t = makeTestContext();
  const m = (await make({ title: 'Rent', repeat_kind: 'monthly', due_on: '2026-01-31' })).body;
  const r1 = (await t.http().post(`/api/tasks/${m.id}/complete`).send({ today: TODAY })).body;
  expect(r1.next.due_on).toBe('2026-02-28');
  const r2 = (await t.http().post(`/api/tasks/${r1.next.id}/complete`).send({ today: TODAY })).body;
  expect(r2.next.due_on).toBe('2026-03-31');
  const o = (await make({ title: 'Once', due_on: TODAY })).body;
  expect((await t.http().post(`/api/tasks/${o.id}/complete`).send({ today: TODAY })).body.next).toBeNull();
});

it('complete twice is a 409; snooze must be after today', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'x', due_on: TODAY })).body;
  await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY });
  expect((await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).status).toBe(409);
  const b = (await make({ title: 'y', due_on: TODAY })).body;
  const bad = await t.http().post(`/api/tasks/${b.id}/snooze`).send({ until: TODAY, today: TODAY });
  expect(bad.status).toBe(400);
  expect(bad.body.details.until).toBeTruthy();
  const ok = await t.http().post(`/api/tasks/${b.id}/snooze`).send({ until: '2026-10-11', today: TODAY });
  expect(ok.body.snoozed_until).toBe('2026-10-11');
});

it('dismiss is for automatic tasks only', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'x' })).body;
  expect((await t.http().post(`/api/tasks/${a.id}/dismiss`).send({ today: TODAY })).status).toBe(400);
});

it('deletes softly and restores', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'x', due_on: TODAY })).body;
  const del = await t.http().delete(`/api/tasks/${a.id}`);
  expect(del.body.ok).toBe(true);
  expect(await list('today')).toHaveLength(0);
  expect((await t.http().post(`/api/tasks/${a.id}/restore`)).status).toBe(200);
  expect(await list('today')).toHaveLength(1);
  expect((await t.http().get(`/api/tasks/${a.id}`)).body.photos).toEqual([]);
});

it('editing a clamped monthly task keeps its anchor day', async () => {
  t = makeTestContext();
  const m = (await make({ title: 'Rent', repeat_kind: 'monthly', due_on: '2026-01-31' })).body;
  const next = (await t.http().post(`/api/tasks/${m.id}/complete`).send({ today: TODAY })).body.next;
  expect(next).toMatchObject({ due_on: '2026-02-28', repeat_anchor_day: 31 });
  const res = await t.http().patch(`/api/tasks/${next.id}`).send({ title: 'Rent due', due_on: '2026-02-28', repeat_kind: 'monthly', today: TODAY });
  expect(res.status).toBe(200);
  expect((await t.http().get(`/api/tasks/${next.id}`)).body.repeat_anchor_day).toBe(31);
});

it('a task whose record was deleted can still be edited when the link is unchanged', async () => {
  t = makeTestContext();
  const item = (await t.http().post('/api/items').send({ section_id: 1, unit: 'g', name: 'Mugwort', amount: 50 })).body;
  const task = (await make({ title: 'Check jar', related_type: 'item', related_id: item.id })).body;
  await t.http().delete(`/api/items/${item.id}`);
  const res = await t.http().patch(`/api/tasks/${task.id}`).send({ title: 'Check the jar', related_type: 'item', related_id: item.id, today: TODAY });
  expect(res.status).toBe(200);
  const other = await t.http().patch(`/api/tasks/${task.id}`).send({ related_type: 'item', related_id: 9999 });
  expect(other.status).toBe(400);
});

it('uncomplete keeps an edited copy and completing again does not make a second one', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', repeat_kind: 'daily', due_on: TODAY })).body;
  const first = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body.next;
  await t.http().patch(`/api/tasks/${first.id}`).send({ title: 'Water well' });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  const again = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body;
  expect(again.next.id).toBe(first.id);
  const open = await list('upcoming');
  expect(open.filter(r => r.title.startsWith('Water'))).toHaveLength(1);
});

it('complete and snooze trust the day only within a day of the clock', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'x', due_on: TODAY })).body;
  const far = await t.http().post(`/api/tasks/${a.id}/snooze`).send({ until: '2026-10-12', today: '2030-01-01' });
  expect(far.status).toBe(200);
  const past = await t.http().post(`/api/tasks/${a.id}/snooze`).send({ until: '2026-10-09', today: '2020-01-01' });
  expect(past.status).toBe(400);
  const done = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: '2030-01-01' })).body;
  expect(done.task.done_on).toBe('2026-10-11');
});

it('uncomplete keeps a copy whose priority was changed, or that has a photo', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', repeat_kind: 'daily', due_on: TODAY })).body;
  const first = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body.next;
  await t.http().patch(`/api/tasks/${first.id}`).send({ priority: 'high' });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  expect((await t.http().get(`/api/tasks/${first.id}`)).status).toBe(200);

  const b = (await make({ title: 'Mist', repeat_kind: 'daily', due_on: TODAY })).body;
  const copy = (await t.http().post(`/api/tasks/${b.id}/complete`).send({ today: TODAY })).body.next;
  t.ctx.db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('task', ?, '1-abcdef12.jpg')").run(copy.id);
  await t.http().post(`/api/tasks/${b.id}/uncomplete`).send({});
  expect((await t.http().get(`/api/tasks/${copy.id}`)).status).toBe(200);
});

it('complete, finish the copy, uncomplete, complete again makes only one copy', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', repeat_kind: 'daily', due_on: TODAY })).body;
  const B = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body.next;
  await t.http().post(`/api/tasks/${B.id}/complete`).send({ today: TODAY });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  const again = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body;
  expect(again.next.id).toBe(B.id);
  // Besides A, only B and the copy B made exist.
  const others = t.ctx.db.prepare("SELECT id FROM tasks WHERE title = 'Water' AND deleted_at IS NULL AND id != ?").all(a.id);
  expect(others).toHaveLength(2);
});

it('after undo, a changed due date makes a new copy on the new date instead of reusing the old one', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', repeat_kind: 'daily', due_on: TODAY })).body;
  const B = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body.next;
  await t.http().post(`/api/tasks/${B.id}/complete`).send({ today: TODAY });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  await t.http().patch(`/api/tasks/${a.id}`).send({ due_on: '2026-10-20' });
  const again = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body;
  expect(again.next.id).not.toBe(B.id);
  expect(again.next.due_on).toBe('2026-10-21');
  expect((await t.http().get(`/api/tasks/${B.id}`)).body.due_on).toBe('2026-10-11');
});

it('after undo, a task changed to not repeat makes no copy and reuses none', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', repeat_kind: 'daily', due_on: TODAY })).body;
  const B = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body.next;
  await t.http().post(`/api/tasks/${B.id}/complete`).send({ today: TODAY });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  await t.http().patch(`/api/tasks/${a.id}`).send({ repeat_kind: 'none' });
  const again = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body;
  expect(again.next).toBeNull();
});

it('after undo, a copy whose own repeat was edited but whose date matches is still reused', async () => {
  t = makeTestContext();
  const a = (await make({ title: 'Water', repeat_kind: 'daily', due_on: TODAY })).body;
  const B = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body.next;
  await t.http().patch(`/api/tasks/${B.id}`).send({ repeat_kind: 'weekly' });
  await t.http().post(`/api/tasks/${a.id}/uncomplete`).send({});
  const again = (await t.http().post(`/api/tasks/${a.id}/complete`).send({ today: TODAY })).body;
  expect(again.next.id).toBe(B.id);
  const others = t.ctx.db.prepare("SELECT id FROM tasks WHERE title = 'Water' AND deleted_at IS NULL AND id != ?").all(a.id);
  expect(others).toHaveLength(1);
});
