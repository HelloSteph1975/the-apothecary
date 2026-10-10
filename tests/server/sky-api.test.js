process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { skyForDay } from '../../server/lib/sky.js';

let t;
afterEach(() => t?.cleanup());
const lists = { recipe_types: '[]', planets: '[]', elements: '[]' };

it('returns the sky for a day and for today by default', async () => {
  t = makeTestContext();
  let res = await t.http().get('/api/sky?date=2026-10-31');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(skyForDay('2026-10-31'));
  expect(res.body.festival).toBe('Samhain');
  res = await t.http().get('/api/sky');
  expect(res.status).toBe(200);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  expect(res.body.day).toBe(today);
});

it('uses her hemisphere setting', async () => {
  t = makeTestContext();
  await t.http().put('/api/settings').send({ hemisphere: 'south' });
  const res = await t.http().get('/api/sky?date=2026-10-31');
  expect(res.body.festival).toBe('Beltane');
  expect(res.body).toEqual(skyForDay('2026-10-31', { hemisphere: 'south' }));
});

it('rejects bad dates', async () => {
  t = makeTestContext();
  for (const bad of ['tomorrow', '2026-13-01', '2026-02-30']) {
    const res = await t.http().get(`/api/sky?date=${bad}`);
    expect(res.status).toBe(400);
    expect(res.body.details.date).toBeTruthy();
  }
});

it('returns a range, inclusive, up to 62 days', async () => {
  t = makeTestContext();
  let res = await t.http().get('/api/sky/range?from=2026-10-01&to=2026-10-03');
  expect(res.status).toBe(200);
  expect(res.body.map(s => s.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  expect(res.body[1]).toEqual(skyForDay('2026-10-02'));
  res = await t.http().get('/api/sky/range?from=2026-10-01&to=2026-10-01');
  expect(res.body).toHaveLength(1);
  res = await t.http().get('/api/sky/range?from=2026-10-01&to=2026-12-01');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(62);
});

it('rejects a range that is too long, backwards or incomplete', async () => {
  t = makeTestContext();
  let res = await t.http().get('/api/sky/range?from=2026-10-01&to=2026-12-02');
  expect(res.status).toBe(400);
  expect(res.body.details.to).toMatch(/62/);
  res = await t.http().get('/api/sky/range?from=2026-10-05&to=2026-10-01');
  expect(res.status).toBe(400);
  expect(res.body.details.to).toBeTruthy();
  res = await t.http().get('/api/sky/range?from=2026-10-05');
  expect(res.status).toBe(400);
  expect(res.body.details.to).toBeTruthy();
  res = await t.http().get('/api/sky/range?from=nope&to=2026-10-05');
  expect(res.body.details.from).toBeTruthy();
});

it('serves start dates for a recipe and 404s for a missing one', async () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  r.timingRules.create({ ...lists, kind: 'day_ruler', value: 'Venus', text: 'Friday work.', weight: 2, recipe_types: '["salve"]' });
  const type = r.recipeTypes.create({ slug: 'salve', name: 'salve' });
  const recipe = r.recipes.create({ name: 'Calendula salve', type_id: type.id });
  let res = await t.http().get(`/api/recipes/${recipe.id}/start-dates?from=2026-10-11`);
  expect(res.status).toBe(200);
  expect(res.body.map(x => x.day)).toEqual(['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);
  expect(res.body[0]).toMatchObject({ score: 2, reasons: ['Friday work.'], sky: { ruler: 'Venus' } });
  await t.http().put('/api/settings').send({ sky_suggestions: 'off' });
  res = await t.http().get(`/api/recipes/${recipe.id}/start-dates?from=2026-10-11`);
  expect(res.body).toEqual([]);
  expect((await t.http().get('/api/recipes/9999/start-dates')).status).toBe(404);
  expect((await t.http().get(`/api/recipes/${recipe.id}/start-dates?from=bad`)).status).toBe(400);
});

it('shows the sky for a batch start date', async () => {
  t = makeTestContext();
  const b = repos(t.ctx.db).batches.create({ name: 'Oil', start_date: '2026-10-16' });
  const res = await t.http().get(`/api/batches/${b.id}`);
  const s = skyForDay('2026-10-16');
  expect(res.body.sky).toEqual({ phase: s.phase.name, sign: s.moon.sign, ruler: 'Venus' });
});

it('adds sky and suggestions to Today, and none when off', async () => {
  t = makeTestContext();
  const s = skyForDay('2026-10-16');
  repos(t.ctx.db).timingRules.create({ ...lists, kind: 'day_ruler', value: 'Venus', text: 'Friday work.', weight: 1 });
  let res = await t.http().get('/api/today?today=2026-10-16');
  expect(res.body.sky).toEqual(s);
  expect(res.body.suggestions).toEqual([{ id: expect.any(Number), text: 'Friday work.' }]);
  await t.http().put('/api/settings').send({ sky_suggestions: 'off' });
  res = await t.http().get('/api/today?today=2026-10-16');
  expect(res.body.suggestions).toEqual([]);
  expect(res.body.sky.ruler).toBe('Venus');
  expect(res.body.sky.phase.name).toBe(s.phase.name);
});

it('reorders timing rules in one call by position', async () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const ids = [0, 1, 2].map(i => r.timingRules.create({ ...lists, kind: 'moon_sign', value: 'Leo', text: `Rule ${i}`, weight: 1, sort_order: i }).id);
  const res = await t.http().put('/api/timing-rules/order').send({ ids: [ids[2], ids[0], ids[1]] });
  expect(res.status).toBe(200);
  expect(res.body.map(x => x.id)).toEqual([ids[2], ids[0], ids[1]]);
  const list = await t.http().get('/api/timing-rules');
  expect(list.body.map(x => x.sort_order)).toEqual([0, 1, 2]);
  const bad = await t.http().put('/api/timing-rules/order').send({ ids: 'nope' });
  expect(bad.status).toBe(400);
});

it('refuses years outside 1900 to 2100 and repeated parameters', async () => {
  t = makeTestContext();
  const msg = 'Pick a date between 1900 and 2100';
  for (const date of ['1899-12-31', '2101-01-01']) {
    const res = await t.http().get(`/api/sky?date=${date}`);
    expect(res.status).toBe(400);
    expect(res.body.details.date).toBe(msg);
  }
  let res = await t.http().get('/api/sky/range?from=1850-01-01&to=1850-01-03');
  expect(res.status).toBe(400);
  expect(res.body.details).toMatchObject({ from: msg, to: msg });
  res = await t.http().get('/api/sky/range?from=2026-01-01&to=2101-01-03');
  expect(res.status).toBe(400);
  expect(res.body.details.to).toBe(msg);
  expect((await t.http().get('/api/sky?date=1900-01-01')).status).toBe(200);
  expect((await t.http().get('/api/sky?date=2100-12-31')).status).toBe(200);
  res = await t.http().get('/api/sky?date=2026-10-01&date=2026-10-02');
  expect(res.status).toBe(400);
  expect(res.body.details.date).toBeTruthy();
  res = await t.http().get('/api/sky/range?from=2026-10-01&from=2026-10-02&to=2026-10-03');
  expect(res.status).toBe(400);
  expect(res.body.details.from).toBeTruthy();
});

it('applies the same limits to start dates', async () => {
  t = makeTestContext();
  const recipe = (await t.http().get('/api/recipes')).body[0];
  const id = recipe?.id ?? 1;
  let res = await t.http().get(`/api/recipes/${id}/start-dates?from=1850-01-01`);
  expect(res.status).toBe(400);
  expect(res.body.details.from).toBe('Pick a date between 1900 and 2100');
  res = await t.http().get(`/api/recipes/${id}/start-dates?from=2026-10-01&from=2026-10-02`);
  expect(res.status).toBe(400);
});
