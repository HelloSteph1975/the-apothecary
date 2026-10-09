import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const salve = r.recipeTypes.create({ name: 'salve', is_topical: 1, sort_order: 0, wait_days: 0 });
  const tea = r.recipeTypes.create({ name: 'tea blend', sort_order: 1 });
  const syrup = r.recipeTypes.create({ name: 'syrup', sort_order: 2 });
  return { h: t.http, r, salve, tea, syrup };
}

it('lists live types in order with a count of live recipes', async () => {
  const { h, r, salve, tea } = setup();
  r.recipes.create({ name: 'Calendula salve', type_id: salve.id });
  r.recipes.create({ name: 'Old salve', type_id: salve.id });
  const gone = r.recipes.create({ name: 'Gone', type_id: tea.id });
  r.recipes.remove(gone.id);
  const res = await h().get('/api/recipe-types');
  expect(res.status).toBe(200);
  expect(res.body.map(x => [x.name, x.recipe_count])).toEqual([['salve', 2], ['tea blend', 0], ['syrup', 0]]);
});

it('creates and edits types, keeping names unique among live types', async () => {
  const { h, r, syrup } = setup();
  let res = await h().post('/api/recipe-types').send({ name: 'Oxymel', icon: 'jar', wait_days: 14 });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: 'Oxymel', icon: 'jar', is_starter: 0, slug: null, is_topical: 0, sort_order: 3 });
  res = await h().post('/api/recipe-types').send({ name: 'SALVE' });
  expect(res.status).toBe(400);
  expect(res.body.details.name).toBe('You already have a type with this name.');
  res = await h().patch(`/api/recipe-types/${syrup.id}`).send({ name: ' Tea Blend ' });
  expect(res.status).toBe(400);
  expect(res.body.details.name).toBe('You already have a type with this name.');
  res = await h().patch(`/api/recipe-types/${syrup.id}`).send({ name: 'Syrup', label_caution: 'Keep cold.' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ name: 'Syrup', label_caution: 'Keep cold.' });
  r.recipeTypes.remove(syrup.id);
  res = await h().post('/api/recipe-types').send({ name: 'syrup' });
  expect(res.status).toBe(201);
  res = await h().post('/api/recipe-types').send({ name: 'x', icon: 'rocket' });
  expect(res.body.details.icon).toBeTruthy();
});

it('asks to move recipes before deleting a type, then moves and deletes together, and undoes', async () => {
  const { h, r, salve, tea, syrup } = setup();
  const a = r.recipes.create({ name: 'A', type_id: salve.id });
  r.recipes.create({ name: 'B', type_id: salve.id });
  let res = await h().delete(`/api/recipe-types/${salve.id}`);
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: 'Move its recipes to another type first.', details: { recipes: 2 } });
  res = await h().delete(`/api/recipe-types/${salve.id}?move_to=${salve.id}`);
  expect(res.status).toBe(400);
  r.recipeTypes.remove(syrup.id);
  res = await h().delete(`/api/recipe-types/${salve.id}?move_to=${syrup.id}`);
  expect(res.status).toBe(400);
  expect(res.body.details.move_to).toBeTruthy();
  res = await h().delete(`/api/recipe-types/${salve.id}?move_to=${tea.id}`);
  expect(res.status).toBe(200);
  expect(res.body.restore).toBe(`/api/recipe-types/${salve.id}/restore`);
  expect(r.recipes.get(a.id).type_id).toBe(tea.id);
  expect(r.recipeTypes.get(salve.id)).toBeNull();
  res = await h().post(`/api/recipe-types/${salve.id}/restore`);
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('salve');
  expect(r.recipes.get(a.id).type_id).toBe(tea.id);
});

it('deletes an unused type straight away', async () => {
  const { h, syrup } = setup();
  const res = await h().delete(`/api/recipe-types/${syrup.id}`);
  expect(res.status).toBe(200);
  expect((await h().get('/api/recipe-types')).body.map(x => x.name)).toEqual(['salve', 'tea blend']);
});

it('reorders types', async () => {
  const { h, salve, tea, syrup } = setup();
  const res = await h().put('/api/recipe-types/order').send({ ids: [syrup.id, salve.id, tea.id] });
  expect(res.status).toBe(200);
  expect(res.body.map(x => x.name)).toEqual(['syrup', 'salve', 'tea blend']);
  expect((await h().put('/api/recipe-types/order').send({ ids: 'nope' })).status).toBe(400);
});
