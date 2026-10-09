import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());
const TODAY = '2026-10-08';

async function supplier(h, name = 'Moonvale Botanicals') {
  return (await h().post('/api/suppliers').send({ name })).body;
}

it('creates a bought herb with its first purchase and lists it with status', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const res = await h().post('/api/items').send({
    section_id: 1, name: 'Calendula', latin_name: 'Calendula officinalis', form: 'dried flower', plant_part: 'flower',
    amount: 40, unit: 'g', low_threshold: 50, acquired_on: '2026-09-01', expires_on: '2026-10-20', storage_spot: 'Top shelf',
    source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: '2026-09-01', price: 9.5 },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const list = (await h().get(`/api/items?today=${TODAY}`)).body;
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({
    name: 'Calendula', section_name: 'Herbs', last_supplier_name: 'Moonvale Botanicals', last_price: 9.5, last_quantity: 40,
    status: { low: true, expiring: true, expired: false },
  });
});

it('restock adds to the amount, logs the purchase and can set a new expiry', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const item = (await h().post('/api/items').send({ section_id: 11, name: 'Amber dropper bottle', size_label: '30 ml', amount: 4, unit: 'count', low_threshold: 6 })).body;
  const res = await h().post(`/api/items/${item.id}/restock`).send({ quantity: 24, supplier_id: sup.id, purchased_on: '2026-10-05', price: 18 });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body).toMatchObject({ amount: 28, source_kind: 'bought' });
  const detail = (await h().get(`/api/items/${item.id}?today=${TODAY}`)).body;
  expect(detail.purchases).toHaveLength(1);
  expect(detail.purchases[0]).toMatchObject({ quantity: 24, unit: 'count', supplier_name: 'Moonvale Botanicals', price: 18 });
  expect(detail.status.low).toBe(false);
});

it('filters by section, search, status, source and supplier', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  await h().post('/api/items').send({ section_id: 1, name: 'Lavender', latin_name: 'Lavandula angustifolia', amount: 100, unit: 'g', expires_on: '2026-09-01', source_kind: 'grown' });
  await h().post('/api/items').send({ section_id: 3, name: 'Beeswax pastilles', amount: 20, unit: 'g', low_threshold: 50, source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: '2026-08-01' } });
  await h().post('/api/items').send({ section_id: 11, name: '2 oz tin', amount: 10, unit: 'count', source_kind: 'gifted', source_from: 'Rowan' });
  const names = async qs => (await h().get(`/api/items?today=${TODAY}&${qs}`)).body.map(i => i.name);
  expect(await names('section_id=1')).toEqual(['Lavender']);
  expect(await names('q=lavandula')).toEqual(['Lavender']);
  expect(await names('status=expired')).toEqual(['Lavender']);
  expect(await names('status=low')).toEqual(['Beeswax pastilles']);
  expect(await names('source_kind=gifted')).toEqual(['2 oz tin']);
  expect(await names(`supplier_id=${sup.id}`)).toEqual(['Beeswax pastilles']);
});

it('marks an item used up and hides it unless asked', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Nettle', amount: 0, unit: 'g' })).body;
  const res = await h().patch(`/api/items/${item.id}`).send({ used_up: true });
  expect(res.body.used_up_at).toBeTruthy();
  expect((await h().get(`/api/items?today=${TODAY}`)).body).toHaveLength(0);
  expect((await h().get(`/api/items?today=${TODAY}&include_used_up=1`)).body).toHaveLength(1);
  expect((await h().patch(`/api/items/${item.id}`).send({ used_up: false })).body.used_up_at).toBeNull();
});

it('rejects bad items and unknown sections with field errors', async () => {
  t = makeTestContext();
  const h = t.http;
  const bad = await h().post('/api/items').send({ section_id: 1, name: '', amount: -1, unit: 'cups' });
  expect(bad.status).toBe(400);
  expect(Object.keys(bad.body.details).sort()).toEqual(['amount', 'name', 'unit']);
  const noSection = await h().post('/api/items').send({ section_id: 999, name: 'Rose', amount: 1, unit: 'g' });
  expect(noSection.status).toBe(400);
  expect(noSection.body.details).toHaveProperty('section_id');
  const noSupplier = await h().post('/api/items').send({ section_id: 1, name: 'Rose', amount: 1, unit: 'g', source_kind: 'bought', purchase: { supplier_id: 999, purchased_on: TODAY } });
  expect(noSupplier.status).toBe(400);
});

it('deletes and restores an item, its purchases staying with it', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const item = (await h().post('/api/items').send({ section_id: 2, name: 'Jojoba oil', amount: 250, unit: 'ml', source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: TODAY, price: 14 } })).body;
  const del = await h().delete(`/api/items/${item.id}`);
  expect((await h().get(`/api/items?today=${TODAY}`)).body).toHaveLength(0);
  expect((await h().get(`/api/suppliers/${sup.id}`)).body.purchases).toHaveLength(0);
  await h().post(del.body.restore);
  expect((await h().get(`/api/suppliers/${sup.id}`)).body.purchases).toHaveLength(1);
});

it('suggests expiry from the form using the settings defaults', async () => {
  t = makeTestContext();
  const h = t.http;
  expect((await h().get('/api/expiry-suggestion?form=dried%20leaf&acquired_on=2026-10-08')).body).toEqual({ expires_on: '2027-10-08' });
  expect((await h().get('/api/expiry-suggestion?form=powder&acquired_on=2026-10-08')).body).toEqual({ expires_on: '2027-04-08' });
  expect((await h().get('/api/expiry-suggestion?form=fresh&acquired_on=2026-10-08')).body).toEqual({ expires_on: null });
  await h().put('/api/settings').send({ expiry_dried_leaf: '18' });
  expect((await h().get('/api/expiry-suggestion?form=dried%20leaf&acquired_on=2026-10-08')).body).toEqual({ expires_on: '2028-04-08' });
});

it('manages sections: add, rename, reorder, and delete only after moving items', async () => {
  t = makeTestContext();
  const h = t.http;
  const added = (await h().post('/api/sections').send({ name: 'Ritual tools' })).body;
  expect(added).toMatchObject({ name: 'Ritual tools', kind: 'supply', sort_order: 15 });
  await h().patch(`/api/sections/${added.id}`).send({ name: 'Altar tools' });
  const ids = (await h().get('/api/sections')).body.map(s => s.id);
  const reordered = [added.id, ...ids.filter(id => id !== added.id)];
  expect((await h().put('/api/sections/order').send({ ids: reordered })).body.map(s => s.name)[0]).toBe('Altar tools');
  await h().post('/api/items').send({ section_id: added.id, name: 'Athame', amount: 1, unit: 'count' });
  const blocked = await h().delete(`/api/sections/${added.id}`);
  expect(blocked.status).toBe(409);
  expect(blocked.body.details).toEqual({ items: 1 });
  const moved = await h().delete(`/api/sections/${added.id}?move_to=14`);
  expect(moved.status).toBe(200);
  expect((await h().get(`/api/items?today=${TODAY}&section_id=14`)).body.map(i => i.name)).toEqual(['Athame']);
  await h().post(moved.body.restore);
  expect((await h().get('/api/sections')).body.some(s => s.name === 'Altar tools')).toBe(true);
});

it('edits and deletes a purchase without touching the amount', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Rose petals', amount: 30, unit: 'g', source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: TODAY, price: 7 } })).body;
  const p = (await h().get(`/api/items/${item.id}?today=${TODAY}`)).body.purchases[0];
  expect((await h().patch(`/api/purchases/${p.id}`).send({ price: 6.5 })).body.price).toBe(6.5);
  await h().delete(`/api/purchases/${p.id}`);
  const after = (await h().get(`/api/items/${item.id}?today=${TODAY}`)).body;
  expect(after.purchases).toHaveLength(0);
  expect(after.amount).toBe(30);
});

it('requires today on list and detail', async () => {
  t = makeTestContext();
  expect((await t.http().get('/api/items')).status).toBe(400);
});

it('used-up items never show in the status lists', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Yarrow', amount: 1, unit: 'g', low_threshold: 5, expires_on: '2026-09-01' })).body;
  await h().patch(`/api/items/${item.id}`).send({ used_up: true });
  for (const status of ['low', 'expiring', 'expired']) {
    expect((await h().get(`/api/items?today=${TODAY}&status=${status}&include_used_up=1`)).body).toHaveLength(0);
  }
});

it('rejects a non-numeric supplier filter', async () => {
  t = makeTestContext();
  const res = await t.http().get(`/api/items?today=${TODAY}&supplier_id=abc`);
  expect(res.status).toBe(400);
  expect(res.body.details).toHaveProperty('supplier_id');
});

it('restock keeps the use by date unless one is sent, and null clears it', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Nettle', amount: 10, unit: 'g', expires_on: '2027-01-01' })).body;
  const kept = await h().post(`/api/items/${item.id}/restock`).send({ quantity: 5, purchased_on: '2026-10-05' });
  expect(kept.status, JSON.stringify(kept.body)).toBe(200);
  expect(kept.body.expires_on).toBe('2027-01-01');
  const changed = await h().post(`/api/items/${item.id}/restock`).send({ quantity: 5, purchased_on: '2026-10-06', expires_on: '2027-06-01' });
  expect(changed.body.expires_on).toBe('2027-06-01');
  const cleared = await h().post(`/api/items/${item.id}/restock`).send({ quantity: 5, purchased_on: '2026-10-07', expires_on: null });
  expect(cleared.body.expires_on).toBeNull();
});

it('does not create purchases directly', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/purchases').send({ item_id: 1, quantity: 1 });
  expect(res.status).toBe(405);
  expect(res.body).toEqual({ error: 'Add purchases from the item page.' });
});

it('ignores repeated query parameters instead of failing', async () => {
  t = makeTestContext();
  await t.http().post('/api/items').send({ section_id: 1, name: 'Nettle', amount: 10, unit: 'g' });
  const res = await t.http().get(`/api/items?today=${TODAY}&section_id=1&section_id=2&q=a&q=b&status=low&status=expired&supplier_id=1&supplier_id=2`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body).toHaveLength(1);
  const two = await t.http().get(`/api/items?today=${TODAY}&storage_spot=a&storage_spot=b`);
  expect(two.status).toBe(200);
});
