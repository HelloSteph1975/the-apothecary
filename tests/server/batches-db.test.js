import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';
import { batchSchema, batchLineSchema, batchStepSchema, finishSchema } from '../../server/schemas.js';

let t;
afterEach(() => t?.cleanup());

it('migration 5 creates the batch tables', () => {
  t = makeTestContext();
  const names = t.ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  expect(names).toEqual(expect.arrayContaining(['batches', 'batch_ingredients', 'batch_steps']));
});

it('batch tables reject bad numbers', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  expect(() => db.prepare("INSERT INTO batches (name, start_date, factor) VALUES ('x', '2026-01-01', 0)").run()).toThrow();
  expect(() => db.prepare("INSERT INTO batches (name, start_date, yield_amount) VALUES ('x', '2026-01-01', 0)").run()).toThrow();
});

it('repos list batches newest first and lines and steps in order', () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const a = r.batches.create({ name: 'A', start_date: '2026-01-01' });
  const b = r.batches.create({ name: 'B', start_date: '2026-02-01' });
  expect(r.batches.list().map(x => x.name)).toEqual(['B', 'A']);
  r.batchIngredients.create({ batch_id: a.id, name: 'second', sort_order: 1 });
  r.batchIngredients.create({ batch_id: a.id, name: 'first', sort_order: 0 });
  expect(r.batchIngredients.list().map(x => x.name)).toEqual(['first', 'second']);
  r.batchSteps.create({ batch_id: b.id, title: 's2', sort_order: 1 });
  r.batchSteps.create({ batch_id: b.id, title: 's1', sort_order: 0 });
  expect(r.batchSteps.list().map(x => x.title)).toEqual(['s1', 's2']);
});

it('batches own photos', () => {
  expect(PHOTO_OWNERS.batch).toBe('batches');
});

it('exports the batch schemas', () => {
  expect(batchSchema.name).toBe('string!');
  expect(batchSchema.start_date).toBe('date!');
  expect(batchSchema.factor).toEqual({ type: 'number', min: 0.01, max: 100 });
  expect(batchLineSchema.drawn_amount).toEqual({ type: 'number', min: 0 });
  expect(batchStepSchema.title).toBe('string!');
  expect(finishSchema.finished_on).toBe('date!');
});
