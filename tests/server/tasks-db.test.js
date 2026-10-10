import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';
import { taskSchema } from '../../server/schemas.js';
import { validate } from '../../server/validate.js';

let t;
afterEach(() => t?.cleanup());

it('migration 7 creates the task tables', () => {
  t = makeTestContext();
  const names = t.ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  expect(names).toEqual(expect.arrayContaining(['tasks', 'task_dismissals']));
  expect(t.ctx.db.prepare('PRAGMA user_version').get().user_version).toBe(7);
});

it('task defaults and checks', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  db.prepare("INSERT INTO tasks (title) VALUES ('x')").run();
  expect(db.prepare('SELECT * FROM tasks').get()).toMatchObject({
    repeat_kind: 'none', repeat_days: '[]', priority: 'normal', kind: 'manual', done_on: null, spawned_id: null,
  });
  expect(() => db.prepare("INSERT INTO tasks (title, repeat_kind) VALUES ('x', 'hourly')").run()).toThrow();
  expect(() => db.prepare("INSERT INTO tasks (title, priority) VALUES ('x', 'urgent')").run()).toThrow();
  expect(() => db.prepare("INSERT INTO tasks (title, related_type) VALUES ('x', 'photo')").run()).toThrow();
  expect(() => db.prepare("INSERT INTO tasks (title, repeat_anchor_day) VALUES ('x', 32)").run()).toThrow();
});

it('the auto_key index allows a second key only once the first is deleted', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const add = () => db.prepare("INSERT INTO tasks (title, kind, auto_key) VALUES ('a', 'auto', 'restock:1:0')").run();
  add();
  expect(add).toThrow();
  db.prepare("UPDATE tasks SET deleted_at = '2026-01-01T00:00:00.000Z'").run();
  expect(add).not.toThrow();
});

it('repos list tasks by due date, undated last', () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  r.tasks.create({ title: 'none' });
  r.tasks.create({ title: 'late', due_on: '2026-11-01' });
  r.tasks.create({ title: 'soon', due_on: '2026-10-11' });
  expect(r.tasks.list().map(x => x.title)).toEqual(['soon', 'late', 'none']);
});

it('tasks own photos and have a schema', () => {
  expect(PHOTO_OWNERS.task).toBe('tasks');
  expect(validate(taskSchema, { title: 'Pot up basil', repeat_kind: 'weekly', priority: 'high', due_on: '2026-10-10' }).errors).toBeUndefined();
  expect(validate(taskSchema, { title: '' }).errors).toBeDefined();
  expect(validate(taskSchema, { title: 'x', repeat_kind: 'hourly' }).errors).toBeDefined();
  expect(validate(taskSchema, { title: 'x', related_type: 'photo' }).errors).toBeDefined();
});
