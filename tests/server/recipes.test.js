import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const salve = r.recipeTypes.create({ name: 'salve', is_topical: 1, wait_days: 1, shelf_life_days: 365, label_caution: 'For outside use only.', icon: 'jar' });
  const tea = r.recipeTypes.create({ name: 'tea blend', shelf_life_days: 180, label_caution: 'Check each herb.', sort_order: 1 });
  const cal = r.herbs.create({ common_name: 'Calendula', caution_pregnancy: 'Ask first.', caution_topical: 'Patch test, daisy family.' });
  const cham = r.herbs.create({ common_name: 'Chamomile', caution_conditions: 'Daisy family allergy.' });
  const mint = r.herbs.create({ common_name: 'Peppermint' });
  return { h: t.http, r, salve, tea, cal, cham, mint };
}

const post = (h, body) => h().post('/api/recipes').send(body);

async function makeSalve(h, s) {
  const res = await post(h, {
    name: 'Calendula salve', type_id: s.salve.id, yield_amount: 200, yield_unit: 'ml', intention: 'Soothing hands',
    ingredients: [
      { herb_id: s.cal.id, amount: 30, unit: 'g', form: 'dried flower' },
      { name: 'Olive oil', amount: 250, unit: 'ml' },
      { name: 'Beeswax', amount: 25, unit: 'g', note: 'pastilles' },
      { name: 'Lavender oil', amount: 10, unit: 'drops' },
      { herb_id: s.cham.id, name: 'Chamomile', amount: null, unit: null },
      { herb_id: s.cal.id, name: 'More calendula', amount: 5, unit: 'g' },
    ],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

it('creates a recipe with ingredients, filling a herb-only name, and returns the detail', async () => {
  const s = setup();
  const d = await makeSalve(s.h, s);
  expect(d).toMatchObject({ name: 'Calendula salve', type_id: s.salve.id, factor: 1, scaled_yield_amount: 200, photos: [] });
  expect(d.type).toMatchObject({ id: s.salve.id, name: 'salve' });
  expect(d.ingredients.map(i => i.name)).toEqual(['Calendula', 'Olive oil', 'Beeswax', 'Lavender oil', 'Chamomile', 'More calendula']);
  expect(d.ingredients[0]).toMatchObject({ herb_id: s.cal.id, herb_name: 'Calendula', herb_deleted: false, amount: 30, base_amount: 30, unit: 'g', form: 'dried flower' });
  expect(d.ingredients[1]).toMatchObject({ herb_id: null, herb_name: null, herb_deleted: false });
  expect(s.r.recipeIngredients.list({ recipe_id: d.id }).map(i => i.sort_order)).toEqual([0, 1, 2, 3, 4, 5]);
});

it('takes wait and shelf life from the type unless the recipe has its own', async () => {
  const s = setup();
  const d = await makeSalve(s.h, s);
  expect(d).toMatchObject({ wait_days: null, effective_wait_days: 1, shelf_life_days: null, effective_shelf_life_days: 365 });
  const res = await s.h().patch(`/api/recipes/${d.id}`).send({ wait_days: 0, shelf_life_days: 90 });
  expect(res.body).toMatchObject({ effective_wait_days: 0, effective_shelf_life_days: 90 });
});

it('scales by a factor and by a target yield', async () => {
  const s = setup();
  const d = await makeSalve(s.h, s);
  let res = await s.h().get(`/api/recipes/${d.id}?scale=0.5`);
  expect(res.body.factor).toBe(0.5);
  expect(res.body.scaled_yield_amount).toBe(100);
  expect(res.body.ingredients.map(i => i.amount)).toEqual([15, 125, 12.5, 5, null, 2.5]);
  expect(res.body.ingredients.map(i => i.base_amount)).toEqual([30, 250, 25, 10, null, 5]);
  res = await s.h().get(`/api/recipes/${d.id}?yield=600`);
  expect(res.body.factor).toBe(3);
  expect(res.body.scaled_yield_amount).toBe(600);
  expect(res.body.ingredients[1].amount).toBe(750);
  res = await s.h().get(`/api/recipes/${d.id}?scale=500`);
  expect(res.status).toBe(400);
  expect(res.body.details.scale).toBeTruthy();
  const plain = (await post(s.h, { name: 'No yield', type_id: s.tea.id })).body;
  expect(plain.scaled_yield_amount).toBeNull();
  res = await s.h().get(`/api/recipes/${plain.id}?yield=5`);
  expect(res.status).toBe(400);
  expect(res.body.details.yield).toBeTruthy();
});

it('groups cautions per live herb in ingredient order, with the label caution and patch-test flag', async () => {
  const s = setup();
  const d = await makeSalve(s.h, s);
  expect(d.cautions).toEqual([
    { herb_id: s.cal.id, common_name: 'Calendula', items: [
      { field: 'caution_pregnancy', text: 'Ask first.' }, { field: 'caution_topical', text: 'Patch test, daisy family.' }] },
    { herb_id: s.cham.id, common_name: 'Chamomile', items: [{ field: 'caution_conditions', text: 'Daisy family allergy.' }] },
  ]);
  expect(d.label_caution).toBe('For outside use only.');
  expect(d.needs_patch_test).toBe(true);
  s.r.herbs.remove(s.cal.id);
  const res = await s.h().get(`/api/recipes/${d.id}`);
  expect(res.body.cautions.map(c => c.common_name)).toEqual(['Chamomile']);
  expect(res.body.ingredients[0]).toMatchObject({ herb_id: s.cal.id, herb_name: null, herb_deleted: true, name: 'Calendula' });
  const tea = (await post(s.h, { name: 'Mint tea', type_id: s.tea.id, ingredients: [{ herb_id: s.mint.id }] })).body;
  expect(tea.cautions).toEqual([]);
  expect(tea.needs_patch_test).toBe(false);
});

it('lists recipes with filters, herb names and counts', async () => {
  const s = setup();
  const d = await makeSalve(s.h, s);
  await post(s.h, { name: 'Mint tea', type_id: s.tea.id, intention: 'Easy evenings', ingredients: [{ herb_id: s.mint.id }, { name: 'Rose petals' }] });
  await post(s.h, { name: '100% Lavender_bag', type_id: s.tea.id });
  const names = async qs => (await s.h().get(`/api/recipes?${qs}`)).body.map(x => x.name);
  const all = (await s.h().get('/api/recipes')).body;
  expect(all.map(x => x.name)).toEqual(['100% Lavender_bag', 'Calendula salve', 'Mint tea']);
  expect(all[1]).toMatchObject({
    id: d.id, type_id: s.salve.id, type_name: 'salve', type_icon: 'jar', is_topical: 1, yield_amount: 200, yield_unit: 'ml',
    ingredient_count: 6, herb_names: ['Calendula', 'Chamomile'], cover: null,
  });
  expect(await names('q=rose')).toEqual(['Mint tea']);
  expect(await names('q=EVENINGS')).toEqual(['Mint tea']);
  expect(await names('q=salve')).toEqual(['Calendula salve']);
  expect(await names('q=%25')).toEqual(['100% Lavender_bag']);
  expect(await names('q=_')).toEqual(['100% Lavender_bag']);
  expect(await names('q[]=x')).toHaveLength(3);
  expect(await names(`type_id=${s.tea.id}`)).toEqual(['100% Lavender_bag', 'Mint tea']);
  expect(await names(`herb_id=${s.mint.id}`)).toEqual(['Mint tea']);
  expect(await names('topical=1')).toEqual(['Calendula salve']);
  expect(await names('topical=0')).toEqual(['100% Lavender_bag', 'Mint tea']);
  s.r.herbs.remove(s.cham.id);
  expect((await s.h().get('/api/recipes')).body[1].herb_names).toEqual(['Calendula']);
});

it('update replaces ingredients; delete and undo bring back ingredients and photos but not replaced ones', async () => {
  const s = setup();
  const d = await makeSalve(s.h, s);
  const oldIds = d.ingredients.map(i => i.id);
  let res = await s.h().patch(`/api/recipes/${d.id}`).send({ ingredients: [{ name: 'Shea butter', amount: 50, unit: 'g' }] });
  expect(res.status).toBe(200);
  expect(res.body.ingredients.map(i => i.name)).toEqual(['Shea butter']);
  expect(res.body.name).toBe('Calendula salve');
  res = await s.h().patch(`/api/recipes/${d.id}`).send({ name: 'Hand salve' });
  expect(res.body.ingredients.map(i => i.name)).toEqual(['Shea butter']);

  const photo = s.r.photos.create({ owner_type: 'recipe', owner_id: d.id, filename: '1-aaaaaaaa.jpg' });
  fs.writeFileSync(path.join(t.dataDir, 'photos', '1-aaaaaaaa.jpg'), 'x');
  res = await s.h().delete(`/api/recipes/${d.id}`);
  expect(res.status).toBe(200);
  expect(res.body.restore).toBe(`/api/recipes/${d.id}/restore`);
  expect((await s.h().get(`/api/recipes/${d.id}`)).status).toBe(404);
  expect(s.r.recipeIngredients.list({ recipe_id: d.id })).toEqual([]);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', '1-aaaaaaaa.jpg'))).toBe(true);
  res = await s.h().post(`/api/recipes/${d.id}/restore`);
  expect(res.status).toBe(200);
  expect(res.body.ingredients.map(i => i.name)).toEqual(['Shea butter']);
  expect(res.body.photos.map(p => p.id)).toEqual([photo.id]);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '1-aaaaaaaa.jpg'))).toBe(true);
  for (const id of oldIds) expect(s.r.recipeIngredients.get(id)).toBeNull();
});

it('rejects bad input with field errors', async () => {
  const s = setup();
  const details = async (body, method = 'post', id) => {
    const res = method === 'post' ? await post(s.h, body) : await s.h().patch(`/api/recipes/${id}`).send(body);
    expect(res.status).toBe(400);
    return res.body.details;
  };
  expect((await details({ type_id: s.tea.id })).name).toBe('Required');
  expect((await details({ name: 'X' })).type_id).toBe('Required');
  s.r.recipeTypes.remove(s.salve.id);
  expect((await details({ name: 'X', type_id: s.salve.id })).type_id).toBeTruthy();
  expect((await details({ name: 'X', type_id: 9999 })).type_id).toBeTruthy();
  expect((await details({ name: 'X', type_id: s.tea.id, yield_amount: 5 })).yield_unit).toBeTruthy();
  expect((await details({ name: 'X', type_id: s.tea.id, yield_amount: 5, yield_unit: 'bucket' })).yield_unit).toBeTruthy();
  expect((await details({ name: 'X', type_id: s.tea.id, ingredients: 'oops' })).ingredients).toBeTruthy();
  expect((await details({ name: 'X', type_id: s.tea.id, ingredients: Array(61).fill({ name: 'a' }) })).ingredients).toBeTruthy();
  const d = await details({ name: 'X', type_id: s.tea.id, ingredients: [
    { name: 'ok' }, {}, { name: 'a', unit: 'bucket', amount: -1 }, { herb_id: 9999 }, null] });
  expect(d['ingredients.1.name']).toBeTruthy();
  expect(d['ingredients.2.unit']).toBeTruthy();
  expect(d['ingredients.2.amount']).toBeTruthy();
  expect(d['ingredients.3.herb_id']).toBeTruthy();
  expect(d['ingredients.4.name']).toBeTruthy();
  expect(d).not.toHaveProperty(['ingredients.0.name']);
  s.r.herbs.remove(s.mint.id);
  expect((await details({ name: 'X', type_id: s.tea.id, ingredients: [{ herb_id: s.mint.id }] }))['ingredients.0.herb_id']).toBeTruthy();
  const ok = (await post(s.h, { name: 'Tea', type_id: s.tea.id, yield_amount: 100, yield_unit: 'g' })).body;
  expect((await details({ yield_unit: null }, 'patch', ok.id)).yield_unit).toBeTruthy();
  expect((await details({ type_id: s.salve.id }, 'patch', ok.id)).type_id).toBeTruthy();
  expect((await s.h().patch(`/api/recipes/${ok.id}`).send({ yield_amount: null, yield_unit: null })).status).toBe(200);
  expect((await s.h().patch('/api/recipes/9999').send({ name: 'x' })).status).toBe(404);
  expect((await s.h().get('/api/recipes/9999')).status).toBe(404);
});
