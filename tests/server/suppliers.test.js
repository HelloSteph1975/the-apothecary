import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('lists suppliers with totals and shows purchase history', async () => {
  t = makeTestContext();
  const h = t.http;
  const a = (await h().post('/api/suppliers').send({ name: 'Moonvale Botanicals', website: 'https://example.com', rating: 5, good_for: 'Dried herbs' })).body;
  await h().post('/api/suppliers').send({ name: 'Tin & Glass Co' });
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Chamomile', amount: 50, unit: 'g', source_kind: 'bought', purchase: { supplier_id: a.id, purchased_on: '2026-09-01', price: 8 } })).body;
  await h().post(`/api/items/${item.id}/restock`).send({ quantity: 50, supplier_id: a.id, purchased_on: '2026-10-01', price: 7.5 });
  const list = (await h().get('/api/suppliers')).body;
  expect(list.map(s => s.name)).toEqual(['Moonvale Botanicals', 'Tin & Glass Co']);
  expect(list[0]).toMatchObject({ purchase_count: 2, total_spent: 15.5, last_purchased_on: '2026-10-01' });
  expect(list[1]).toMatchObject({ purchase_count: 0, total_spent: 0, last_purchased_on: null });
  const detail = (await h().get(`/api/suppliers/${a.id}`)).body;
  expect(detail.purchases.map(p => [p.item_name, p.purchased_on, p.price])).toEqual([['Chamomile', '2026-10-01', 7.5], ['Chamomile', '2026-09-01', 8]]);
});

it('validates rating and name', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/suppliers').send({ name: '', rating: 9 });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.details).sort()).toEqual(['name', 'rating']);
});

it('deleting a supplier keeps item history readable and undo brings it back', async () => {
  t = makeTestContext();
  const h = t.http;
  const s = (await h().post('/api/suppliers').send({ name: 'Old Shop' })).body;
  const item = (await h().post('/api/items').send({ section_id: 3, name: 'Candelilla wax', amount: 100, unit: 'g', source_kind: 'bought', purchase: { supplier_id: s.id, purchased_on: '2026-08-01' } })).body;
  const del = await h().delete(`/api/suppliers/${s.id}`);
  expect((await h().get('/api/suppliers')).body).toHaveLength(0);
  const p = (await h().get(`/api/items/${item.id}?today=2026-10-08`)).body.purchases[0];
  expect(p).toMatchObject({ supplier_name: 'Old Shop' });
  expect(p.supplier_deleted_at).toBeTruthy();
  await h().post(del.body.restore);
  expect((await h().get('/api/suppliers')).body).toHaveLength(1);
});

it('rejects websites that are not http or https, and accepts https', async () => {
  t = makeTestContext();
  const h = t.http;
  const bad = await h().post('/api/suppliers').send({ name: 'Bad', website: 'javascript:alert(1)' });
  expect(bad.status).toBe(400);
  expect(bad.body.details.website).toBe('Enter a web address starting with https://');
  const ok = await h().post('/api/suppliers').send({ name: 'Good', website: 'https://example.com' });
  expect(ok.status).toBe(201);
  const patch = await h().patch(`/api/suppliers/${ok.body.id}`).send({ website: 'javascript:alert(1)' });
  expect(patch.status).toBe(400);
  expect(patch.body.details.website).toBeTruthy();
  expect((await h().patch(`/api/suppliers/${ok.body.id}`).send({ website: 'http://example.org' })).status).toBe(200);
});
