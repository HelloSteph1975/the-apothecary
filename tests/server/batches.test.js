import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { dueSteps } from '../../server/services/batches.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const salve = r.recipeTypes.create({ name: 'salve', is_topical: 1, wait_days: 14, shelf_life_days: 365, label_caution: 'For outside use only.', icon: 'jar' });
  const tea = r.recipeTypes.create({ name: 'tea blend', shelf_life_days: 180, label_caution: 'Check each herb.', sort_order: 1 });
  const cal = r.herbs.create({ common_name: 'Calendula' });
  const mint = r.herbs.create({ common_name: 'Peppermint' });
  return { h: t.http, r, salve, tea, cal, mint };
}

const addItem = (h, body) => h().post('/api/items').send({ section_id: 1, unit: 'g', amount: 100, ...body }).then(res => {
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
});

async function makeRecipe(s, extra = {}) {
  const res = await s.h().post('/api/recipes').send({
    name: 'Calendula salve', type_id: s.salve.id, yield_amount: 200, yield_unit: 'ml', intention: 'Soothing hands', steps: 'Warm the oil.',
    ingredients: [
      { herb_id: s.cal.id, amount: 30, unit: 'g' },
      { name: 'Olive oil', amount: 250, unit: 'ml' },
      { name: 'Beeswax', amount: 25, unit: 'g' },
    ],
    ...extra,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

const plan = (s, body) => s.h().post('/api/batches/plan').send(body);

// plan ---------------------------------------------------------------------

it('plans a batch: name, steps from the wait, and prefill text', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const res = await plan(s, { recipe_id: rec.id, start_date: '2026-10-09' });
  expect(res.status).toBe(200);
  expect(res.body.recipe).toEqual({ id: rec.id, name: 'Calendula salve', type_id: s.salve.id, type_name: 'salve' });
  expect(res.body.name).toBe('Calendula salve, October 9');
  expect(res.body.factor).toBe(1);
  expect(res.body.start_date).toBe('2026-10-09');
  expect(res.body.steps).toEqual([{ title: 'Strain and bottle', due_on: '2026-10-23' }]);
  expect(res.body.prefill).toEqual({
    intention: 'Soothing hands', method: 'Warm the oil.', base: 'Olive oil, Beeswax',
    label_notes: 'For outside use only. Keeps about 1 year.',
  });
  expect(res.body.lines).toHaveLength(3);
});

it('defaults the start date to today and has no steps when there is no wait', async () => {
  const s = setup();
  const rec = await makeRecipe(s, { type_id: s.tea.id, wait_days: 0, shelf_life_days: 14 });
  const res = await plan(s, { recipe_id: rec.id });
  expect(res.body.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(res.body.steps).toEqual([]);
  expect(res.body.prefill.label_notes).toBe('Check each herb. Keeps about 2 weeks.');
});

it('plans with scale and yield, and rejects bad ones', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const two = await plan(s, { recipe_id: rec.id, scale: 2 });
  expect(two.body.factor).toBe(2);
  expect(two.body.lines[0].amount).toBe(60);
  const y = await plan(s, { recipe_id: rec.id, yield: 100 });
  expect(y.body.factor).toBe(0.5);
  expect(y.body.lines[0].amount).toBe(15);
  expect((await plan(s, { recipe_id: rec.id, scale: 1000 })).status).toBe(400);
  expect((await plan(s, { recipe_id: 9999 })).status).toBe(404);
  expect((await plan(s, {})).status).toBe(400);
});

it('finds jars by herb link and by name, with the flags', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const linked = await addItem(s.h, { name: 'Dried marigold', herb_id: s.cal.id, amount: 50 });
  await addItem(s.h, { name: 'Olive Oil', unit: 'ml', amount: 300 });
  const gone = await addItem(s.h, { name: 'Beeswax', amount: 10 });
  await s.h().patch(`/api/items/${gone.id}`).send({ used_up: true });
  const res = await plan(s, { recipe_id: rec.id, start_date: '2026-10-09' });
  const [cal, oil, wax] = res.body.lines;
  expect(cal.candidates.map(c => c.id)).toEqual([linked.id]);
  expect(cal).toMatchObject({ suggested_item_id: linked.id, suggested_draw: 30, flag: null, herb_id: s.cal.id, name: 'Calendula', unit: 'g' });
  expect(cal.candidates[0]).toMatchObject({ name: 'Dried marigold', amount: 50, unit: 'g', convertible: true });
  expect(oil.candidates).toHaveLength(1);
  expect(oil.flag).toBe(null);
  expect(wax.candidates).toEqual([]);
  expect(wax.flag).toBe('no_jar');
  expect(wax.suggested_item_id).toBe(null);
});

it('converts draws into the jar unit and flags what cannot convert', async () => {
  const s = setup();
  const rec = await makeRecipe(s, { ingredients: [
    { name: 'Beeswax', amount: 56.699, unit: 'g' },
    { name: 'Olive oil', amount: 2, unit: 'tbsp' },
    { name: 'Rose', amount: 5, unit: 'g' },
    { name: 'Lavender', amount: 5, unit: 'g' },
    { name: 'Sage', amount: null, unit: null },
  ] });
  await addItem(s.h, { name: 'Beeswax', unit: 'oz', amount: 4 });
  await addItem(s.h, { name: 'Olive oil', unit: 'ml', amount: 500 });
  await addItem(s.h, { name: 'Rose', unit: 'ml', amount: 500 });
  await addItem(s.h, { name: 'Lavender', unit: 'g', amount: 2 });
  await addItem(s.h, { name: 'Sage', unit: 'g', amount: 2 });
  const lines = (await plan(s, { recipe_id: rec.id })).body.lines;
  expect(lines[0].suggested_draw).toBeCloseTo(2, 4);
  expect(lines[0].flag).toBe(null);
  expect(lines[1].suggested_draw).toBe(29.5736);
  expect(lines[2]).toMatchObject({ suggested_draw: null, flag: 'no_conversion' });
  expect(lines[2].candidates[0].convertible).toBe(false);
  expect(lines[2].candidates[0].draw).toBe(null);
  expect(lines[0].candidates[0]).toMatchObject({ convertible: true });
  expect(lines[0].candidates[0].draw).toBeCloseTo(2, 4);
  expect(lines[1].candidates[0].draw).toBe(29.5736);
  expect(lines[3]).toMatchObject({ suggested_draw: 5, flag: 'not_enough' });
  expect(lines[4]).toMatchObject({ suggested_draw: null, flag: 'no_amount' });
});

it('sorts candidates: convertible, enough stock, earliest expiry, then name', async () => {
  const s = setup();
  const rec = await makeRecipe(s, { ingredients: [{ name: 'Calendula', amount: 30, unit: 'g' }] });
  const ml = await addItem(s.h, { name: 'calendula', unit: 'ml', amount: 500 });
  const small = await addItem(s.h, { name: 'Calendula', amount: 10, expires_on: '2026-11-01' });
  const late = await addItem(s.h, { name: 'CALENDULA', amount: 100, expires_on: '2027-01-01' });
  const soon = await addItem(s.h, { name: 'Calendula', amount: 100, expires_on: '2026-12-01' });
  const none = await addItem(s.h, { name: 'Calendula', amount: 100 });
  const c = (await plan(s, { recipe_id: rec.id })).body.lines[0].candidates;
  expect(c.map(x => x.id)).toEqual([soon.id, late.id, none.id, small.id, ml.id]);
});

// create -------------------------------------------------------------------

const baseBatch = { name: 'Salve one', start_date: '2026-10-09' };

it('creates a batch, drawing from jars in their own unit', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const a = await addItem(s.h, { name: 'Calendula', amount: 50 });
  const b = await addItem(s.h, { name: 'Beeswax', unit: 'oz', amount: 4 });
  const res = await s.h().post('/api/batches').send({
    ...baseBatch, recipe_id: rec.id, type_id: s.salve.id, factor: 1,
    lines: [
      { herb_id: s.cal.id, name: 'Calendula', amount: 30, unit: 'g', item_id: a.id, drawn_amount: 30 },
      { name: 'Beeswax', amount: 25, unit: 'g', item_id: b.id, drawn_amount: 0.88 },
      { name: 'Olive oil', amount: 250, unit: 'ml' },
    ],
    steps: [{ title: 'Strain and bottle', due_on: '2026-10-23' }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  expect(res.body.lines).toHaveLength(3);
  expect(res.body.lines[0]).toMatchObject({ drawn_amount: 30, drawn_unit: 'g', item: { id: a.id, name: 'Calendula', live: true } });
  expect(res.body.lines[1].drawn_unit).toBe('oz');
  expect(res.body.lines[2].item).toBe(null);
  expect(res.body.status).toBe('steeping');
  expect(res.body.recipe).toEqual({ id: rec.id, name: 'Calendula salve' });
  expect(res.body.type).toEqual({ id: s.salve.id, name: 'salve' });
  const r = repos(t.ctx.db);
  expect(r.items.get(a.id).amount).toBe(20);
  expect(r.items.get(b.id).amount).toBeCloseTo(3.12, 5);
});

it('asks before drawing more than a jar holds and writes nothing', async () => {
  const s = setup();
  const a = await addItem(s.h, { name: 'Calendula', amount: 10 });
  const body = { ...baseBatch, lines: [{ name: 'Calendula', amount: 30, unit: 'g', item_id: a.id, drawn_amount: 30 }] };
  const res = await s.h().post('/api/batches').send(body);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('Some jars hold less than you are drawing.');
  expect(res.body.details.short).toEqual([{ line: 0, item_id: a.id, name: 'Calendula', has: 10, wants: 30, unit: 'g' }]);
  expect(repos(t.ctx.db).batches.list()).toEqual([]);
  expect(repos(t.ctx.db).items.get(a.id).amount).toBe(10);
});

it('with confirm_short it empties the jar, never below zero, and marks it used up', async () => {
  const s = setup();
  const a = await addItem(s.h, { name: 'Calendula', amount: 10 });
  const res = await s.h().post('/api/batches').send({ ...baseBatch, confirm_short: true,
    lines: [{ name: 'Calendula', amount: 30, unit: 'g', item_id: a.id, drawn_amount: 30 }] });
  expect(res.status).toBe(201);
  const item = repos(t.ctx.db).items.get(a.id);
  expect(item.amount).toBe(0);
  expect(item.used_up_at).toBeTruthy();
});

it('flags whether a line herb is still in the grimoire', async () => {
  const s = setup();
  const gone = repos(t.ctx.db).herbs.create({ common_name: 'Gone herb' });
  const res = await s.h().post('/api/batches').send({ ...baseBatch, lines: [
    { herb_id: s.cal.id, name: 'Calendula' }, { herb_id: gone.id, name: 'Gone herb' }, { name: 'Plain' },
  ] });
  expect(res.status).toBe(201);
  repos(t.ctx.db).herbs.remove(gone.id, '2026-10-09 10:00:00');
  const body = (await s.h().get(`/api/batches/${res.body.id}`)).body;
  expect(body.lines.map(l => l.herb_live)).toEqual([true, false, false]);
});

it('stores what the jar really gave when a short draw is confirmed', async () => {
  const s = setup();
  const a = await addItem(s.h, { name: 'Calendula', amount: 4 });
  const res = await s.h().post('/api/batches').send({ ...baseBatch, confirm_short: true,
    lines: [{ name: 'Calendula', amount: 10, unit: 'g', item_id: a.id, drawn_amount: 10 }] });
  expect(res.status).toBe(201);
  expect(res.body.lines[0].amount).toBe(10);
  expect(res.body.lines[0].drawn_amount).toBe(4);
  expect(repos(t.ctx.db).items.get(a.id).amount).toBe(0);
  const b = await addItem(s.h, { name: 'Rose', amount: 10 });
  const res2 = await s.h().post('/api/batches').send({ ...baseBatch, confirm_short: true, lines: [
    { name: 'Rose', item_id: b.id, drawn_amount: 6 }, { name: 'Rose again', item_id: b.id, drawn_amount: 6 },
  ] });
  expect(res2.status).toBe(201);
  expect(res2.body.lines.map(l => l.drawn_amount)).toEqual([6, 4]);
});

it('counts two lines on one jar together', async () => {
  const s = setup();
  const a = await addItem(s.h, { name: 'Calendula', amount: 10 });
  const res = await s.h().post('/api/batches').send({ ...baseBatch, lines: [
    { name: 'Calendula', item_id: a.id, drawn_amount: 6 }, { name: 'Calendula again', item_id: a.id, drawn_amount: 6 },
  ] });
  expect(res.status).toBe(409);
  expect(res.body.details.short.map(x => x.line)).toEqual([1]);
  expect(res.body.details.short[0].has).toBe(4);
});

it('creates a free-form batch', async () => {
  const s = setup();
  const res = await s.h().post('/api/batches').send({ ...baseBatch, lines: [{ name: 'Chamomile', amount: 2, unit: 'tbsp' }] });
  expect(res.status).toBe(201);
  expect(res.body.recipe).toBe(null);
  expect(res.body.status).toBe('ready');
  expect(res.body.lines[0].name).toBe('Chamomile');
  expect((await s.h().post('/api/batches').send({ start_date: '2026-10-09' })).status).toBe(400);
});

it('rejects a dead or missing jar, a negative draw, and a nameless line', async () => {
  const s = setup();
  const a = await addItem(s.h, { name: 'Calendula', amount: 10 });
  await s.h().delete(`/api/items/${a.id}`);
  let res = await s.h().post('/api/batches').send({ ...baseBatch, lines: [{ name: 'Calendula', item_id: a.id, drawn_amount: 1 }] });
  expect(res.status).toBe(400);
  expect(res.body.details['lines.0.item_id']).toBeTruthy();
  res = await s.h().post('/api/batches').send({ ...baseBatch, lines: [{ name: 'x', drawn_amount: -1 }, {}] });
  expect(res.status).toBe(400);
  expect(res.body.details['lines.0.drawn_amount']).toBeTruthy();
  expect(res.body.details['lines.1.name']).toBeTruthy();
  expect(repos(t.ctx.db).batches.list()).toEqual([]);
});

// list and detail ----------------------------------------------------------

async function makeBatch(s, over = {}) {
  const res = await s.h().post('/api/batches').send({ ...baseBatch, lines: [{ name: 'Calendula', amount: 3, unit: 'g' }], ...over });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

it('lists active batches by next due date, then finished, and filters', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const late = await makeBatch(s, { name: 'Late', recipe_id: rec.id, type_id: s.salve.id, steps: [{ title: 'Strain', due_on: '2026-11-01' }, { title: 'Label', due_on: '2026-12-01' }] });
  const soon = await makeBatch(s, { name: 'Soon', steps: [{ title: 'Strain', due_on: '2026-10-15' }] });
  const nosteps = await makeBatch(s, { name: 'Nosteps' });
  const fin = await makeBatch(s, { name: 'Done one', lines: [{ name: 'Lavender' }] });
  await s.h().post(`/api/batches/${fin.id}/finish`).send({ finished_on: '2026-10-09' });
  const all = (await s.h().get('/api/batches')).body;
  expect(all.map(b => b.name)).toEqual(['Soon', 'Late', 'Nosteps', 'Done one']);
  expect(all[1]).toMatchObject({ recipe_name: 'Calendula salve', type_name: 'salve', open_steps: 2, next_step: { title: 'Strain', due_on: '2026-11-01' }, cover: null });
  expect(all[2].next_step).toBe(null);
  expect((await s.h().get('/api/batches?status=active')).body.map(b => b.id)).toEqual([soon.id, late.id, nosteps.id]);
  expect((await s.h().get('/api/batches?status=finished')).body.map(b => b.id)).toEqual([fin.id]);
  expect((await s.h().get(`/api/batches?recipe_id=${rec.id}`)).body.map(b => b.id)).toEqual([late.id]);
  expect((await s.h().get('/api/batches?q=calendula salve')).body.map(b => b.id)).toEqual([late.id]);
  expect((await s.h().get('/api/batches?q=lavender')).body.map(b => b.id)).toEqual([fin.id]);
  expect((await s.h().get('/api/batches?q=100%25')).body).toEqual([]);
});

it('reports steeping, ready and finished', async () => {
  const s = setup();
  const b = await makeBatch(s, { steps: [{ title: 'Strain', due_on: '2026-10-15' }] });
  const get = async () => (await s.h().get(`/api/batches/${b.id}`)).body;
  expect((await get()).status).toBe('steeping');
  await s.h().patch(`/api/batches/${b.id}/steps/${b.steps[0].id}`).send({ done_on: '2026-10-15' });
  expect((await get()).status).toBe('ready');
  await s.h().post(`/api/batches/${b.id}/finish`).send({ finished_on: '2026-10-16' });
  expect((await get()).status).toBe('finished');
  expect((await s.h().get('/api/batches/9999')).status).toBe(404);
});

it('edits batch fields but not lines', async () => {
  const s = setup();
  const b = await makeBatch(s);
  const res = await s.h().patch(`/api/batches/${b.id}`).send({ noticed: 'Smells lovely', name: 'Renamed', lines: [] });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ noticed: 'Smells lovely', name: 'Renamed' });
  expect(res.body.lines).toHaveLength(1);
  expect((await s.h().patch(`/api/batches/${b.id}`).send({ name: '' })).status).toBe(400);
});

it('adds, edits, completes, deletes and restores steps', async () => {
  const s = setup();
  const b = await makeBatch(s);
  let res = await s.h().post(`/api/batches/${b.id}/steps`).send({ title: 'Shake daily', due_on: '2026-10-10' });
  expect(res.status).toBe(201);
  const id = res.body.id;
  res = await s.h().patch(`/api/batches/${b.id}/steps/${id}`).send({ title: 'Shake twice', done_on: '2026-10-10' });
  expect(res.body).toMatchObject({ title: 'Shake twice', done_on: '2026-10-10' });
  expect((await s.h().patch(`/api/batches/${b.id}/steps/${id}`).send({ title: '' })).status).toBe(400);
  expect((await s.h().patch(`/api/batches/${b.id}/steps/99999`).send({ title: 'x' })).status).toBe(404);
  res = await s.h().delete(`/api/batches/${b.id}/steps/${id}`);
  expect(res.body.restore).toBe(`/api/batches/${b.id}/steps/${id}/restore`);
  expect((await s.h().get(`/api/batches/${b.id}`)).body.steps).toEqual([]);
  expect((await s.h().post(res.body.restore)).status).toBe(200);
  expect((await s.h().get(`/api/batches/${b.id}`)).body.steps).toHaveLength(1);
});

// finish -------------------------------------------------------------------

it('finishes, defaulting the expiry from the recipe shelf life, and closes open steps', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const b = await makeBatch(s, { recipe_id: rec.id, type_id: s.salve.id, steps: [{ title: 'Strain', due_on: '2026-10-23' }] });
  const res = await s.h().post(`/api/batches/${b.id}/finish`).send({ finished_on: '2026-10-23', yield_amount: 180, yield_unit: 'ml' });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body).toMatchObject({ finished_on: '2026-10-23', expires_on: '2027-10-23', yield_amount: 180, status: 'finished' });
  expect(res.body.steps[0].done_on).toBe('2026-10-23');
  expect((await s.h().post(`/api/batches/${b.id}/finish`).send({ finished_on: '2026-10-24' })).status).toBe(409);
});

it('rejects a yield of zero with a 400', async () => {
  const s = setup();
  const b = await makeBatch(s, {});
  const res = await s.h().post(`/api/batches/${b.id}/finish`).send({ finished_on: '2026-10-23', yield_amount: 0, yield_unit: 'ml' });
  expect(res.status).toBe(400);
  expect(res.body.details.yield_amount).toBe('Must be more than 0');
});

it('uses the type shelf life for a free-form batch and an explicit expiry when given', async () => {
  const s = setup();
  const a = await makeBatch(s, { type_id: s.tea.id });
  expect((await s.h().post(`/api/batches/${a.id}/finish`).send({ finished_on: '2026-10-09' })).body.expires_on).toBe('2027-04-07');
  const b = await makeBatch(s, { type_id: s.tea.id });
  expect((await s.h().post(`/api/batches/${b.id}/finish`).send({ finished_on: '2026-10-09', expires_on: '2026-12-25' })).body.expires_on).toBe('2026-12-25');
  const c = await makeBatch(s);
  expect((await s.h().post(`/api/batches/${c.id}/finish`).send({ finished_on: '2026-10-09' })).body.expires_on).toBe(null);
  expect((await s.h().post(`/api/batches/${c.id}/finish`).send({})).status).toBe(409);
});

it('adds the finished batch to the cabinet as a made jar', async () => {
  const s = setup();
  const b = await makeBatch(s, { type_id: s.tea.id, name: 'Sleepy tea' });
  const res = await s.h().post(`/api/batches/${b.id}/finish`).send({
    finished_on: '2026-10-09', add_to_cabinet: { section_id: 1, name: 'Sleepy tea jar', amount: 120, unit: 'g', form: 'other', storage_spot: 'Shelf 2' },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.made_item).toMatchObject({ name: 'Sleepy tea jar' });
  const item = repos(t.ctx.db).items.get(res.body.made_item.id);
  expect(item).toMatchObject({ source_kind: 'made', source_from: 'Sleepy tea', acquired_on: '2026-10-09', expires_on: '2027-04-07', amount: 120, unit: 'g', storage_spot: 'Shelf 2' });
  expect(res.body.item_id).toBe(item.id);
});

it('checks the cabinet jar unit and writes nothing when it is wrong', async () => {
  const s = setup();
  const b = await makeBatch(s);
  const res = await s.h().post(`/api/batches/${b.id}/finish`).send({
    finished_on: '2026-10-09', add_to_cabinet: { section_id: 1, name: 'Jar', amount: 5, unit: 'tbsp' },
  });
  expect(res.status).toBe(400);
  expect(res.body.details['add_to_cabinet.unit']).toBeTruthy();
  expect((await s.h().get(`/api/batches/${b.id}`)).body.finished_on).toBe(null);
  expect(repos(t.ctx.db).items.list()).toEqual([]);
  const missing = await s.h().post(`/api/batches/${b.id}/finish`).send({ finished_on: '2026-10-09', add_to_cabinet: { section_id: 1, unit: 'g' } });
  expect(missing.status).toBe(400);
  expect(missing.body.details['add_to_cabinet.amount']).toBeTruthy();
});

it('unfinishes but leaves the made jar alone', async () => {
  const s = setup();
  const b = await makeBatch(s);
  const fin = await s.h().post(`/api/batches/${b.id}/finish`).send({
    finished_on: '2026-10-09', yield_amount: 5, yield_unit: 'g', add_to_cabinet: { section_id: 1, name: 'Jar', amount: 5, unit: 'g' },
  });
  const res = await s.h().post(`/api/batches/${b.id}/unfinish`);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ finished_on: null, yield_amount: null, yield_unit: null, expires_on: null, status: 'ready' });
  expect(repos(t.ctx.db).items.get(fin.body.made_item.id)).toBeTruthy();
  expect((await s.h().post(`/api/batches/${b.id}/unfinish`)).status).toBe(409);
});

// delete -------------------------------------------------------------------

it('deleting and undoing a batch never changes jar amounts', async () => {
  const s = setup();
  const a = await addItem(s.h, { name: 'Calendula', amount: 50 });
  const b = await makeBatch(s, { lines: [{ name: 'Calendula', amount: 30, unit: 'g', item_id: a.id, drawn_amount: 30 }], steps: [{ title: 'Strain' }] });
  const photo = repos(t.ctx.db).photos.create({ owner_type: 'batch', owner_id: b.id, filename: 'x.jpg' });
  const del = await s.h().delete(`/api/batches/${b.id}`);
  expect(del.body.restore).toBe(`/api/batches/${b.id}/restore`);
  const r = repos(t.ctx.db);
  expect(r.items.get(a.id).amount).toBe(20);
  expect(r.batchIngredients.list()).toEqual([]);
  expect(r.batchSteps.list()).toEqual([]);
  expect((await s.h().get(`/api/batches/${b.id}`)).status).toBe(404);
  const res = await s.h().post(del.body.restore);
  expect(res.status).toBe(200);
  expect(res.body.lines).toHaveLength(1);
  expect(res.body.steps).toHaveLength(1);
  expect(r.items.get(a.id).amount).toBe(20);
  expect(r.photos.get(photo.id)).toBeTruthy();
});

it('keeps a step deleted on its own deleted when the batch comes back', async () => {
  const s = setup();
  const b = await makeBatch(s, { steps: [{ title: 'One' }, { title: 'Two' }] });
  await s.h().delete(`/api/batches/${b.id}/steps/${b.steps[0].id}`);
  const del = await s.h().delete(`/api/batches/${b.id}`);
  const res = await s.h().post(del.body.restore);
  expect(res.body.steps.map(x => x.title)).toEqual(['Two']);
});

// today --------------------------------------------------------------------

it('lists steps due within seven days, overdue first, skipping finished and deleted batches', async () => {
  const s = setup();
  const a = await makeBatch(s, { name: 'A', steps: [{ title: 'Overdue', due_on: '2026-10-05' }, { title: 'Far', due_on: '2026-10-20' }, { title: 'Undated' }] });
  await makeBatch(s, { name: 'B', steps: [{ title: 'Edge', due_on: '2026-10-15' }, { title: 'Past edge', due_on: '2026-10-16' }] });
  const c = await makeBatch(s, { name: 'C', steps: [{ title: 'Finished batch', due_on: '2026-10-09' }] });
  await s.h().post(`/api/batches/${c.id}/finish`).send({ finished_on: '2026-10-09' });
  const d = await makeBatch(s, { name: 'D', steps: [{ title: 'Deleted batch', due_on: '2026-10-09' }] });
  await s.h().delete(`/api/batches/${d.id}`);
  const due = dueSteps(t.ctx.db, '2026-10-08');
  expect(due.map(x => x.title)).toEqual(['Overdue', 'Edge']);
  expect(due[0]).toMatchObject({ batch_id: a.id, batch_name: 'A', due_on: '2026-10-05', overdue: true });
  expect(due[1].overdue).toBe(false);
  const res = await s.h().get('/api/today?today=2026-10-08');
  expect(res.body.batchesDue.map(x => x.title)).toEqual(['Overdue', 'Edge']);
  expect(res.body.counts.batchesDue).toBe(2);
});

// Greptile round 1 -------------------------------------------------------------

it('keeps working after a backup restore swaps the database handle', async () => {
  const s = setup();
  const { backupNow, restoreBackup } = await import('../../server/services/backup.js');
  const { name } = backupNow(t.ctx.db, t.dataDir);
  restoreBackup(t.ctx, name);
  const res = await s.h().get('/api/batches');
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect((await s.h().post('/api/batches/plan').send({ recipe_id: (await makeRecipe(s)).id })).status).toBe(200);
});

it('suggests a jar by name for a herb-linked ingredient when no jar is linked to the herb', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const jar = await addItem(s.h, { name: 'calendula', amount: 100 });
  const res = await plan(s, { recipe_id: rec.id, start_date: '2026-10-09' });
  const line = res.body.lines[0];
  expect(line.candidates.map(c => c.id)).toEqual([jar.id]);
  expect(line.suggested_item_id).toBe(jar.id);
});

it('lists herb-linked jars before name-only matches, without duplicates', async () => {
  const s = setup();
  const rec = await makeRecipe(s);
  const named = await addItem(s.h, { name: 'Calendula', amount: 500 });
  const linked = await addItem(s.h, { name: 'Marigold flowers', herb_id: s.cal.id, amount: 100 });
  const both = await addItem(s.h, { name: 'Calendula', herb_id: s.cal.id, amount: 100 });
  const res = await plan(s, { recipe_id: rec.id, start_date: '2026-10-09' });
  const ids = res.body.lines[0].candidates.map(c => c.id);
  expect(ids).toHaveLength(3);
  expect(new Set(ids).size).toBe(3);
  expect(ids.indexOf(named.id)).toBe(2);
  expect(ids.slice(0, 2).sort()).toEqual([linked.id, both.id].sort());
  expect(res.body.lines[0].suggested_item_id).not.toBe(named.id);
});
