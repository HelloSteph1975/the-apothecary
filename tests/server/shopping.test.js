process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, describe } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { migrations } from '../../server/db/migrations.js';
import { localToday } from '../../server/services/timing.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const s = { h: t.http, r, db: t.ctx.db };
  s.section = name => r.sections.create({ name, sort_order: 5 });
  s.supplier = name => r.suppliers.create({ name });
  s.herb = name => r.herbs.create({ common_name: name, latin_name: `${name} latinus` });
  s.jar = (body = {}) => s.h().post('/api/items').send({ section_id: 1, name: 'Sage', unit: 'g', amount: 5, low_threshold: 10, ...body }).then(res => res.body);
  s.buy = (itemId, body = {}) => r.purchases.create({ item_id: itemId, supplier_id: null, purchased_on: '2026-09-01', quantity: 50, unit: 'g', price: 8, ...body });
  s.add = (body = {}) => s.h().post('/api/shopping/items').send({ name: 'Beeswax', ...body });
  s.list = (q = '') => s.h().get(`/api/shopping${q}`).then(res => res.body);
  s.checked = id => s.db.prepare('SELECT checked_on FROM shopping_items WHERE id = ?').get(id).checked_on;
  return s;
}

const rowNames = list => list.groups.map(g => [g.name, g.rows.map(r => r.name)]);

describe('migration 10', () => {
  it('creates the shopping tables and index', () => {
    t = makeTestContext();
    expect(migrations.length).toBeGreaterThanOrEqual(10);
    const names = type => t.ctx.db.prepare(`SELECT name FROM sqlite_master WHERE type = '${type}'`).all().map(r => r.name);
    expect(names('table')).toEqual(expect.arrayContaining(['shopping_items', 'shopping_checks']));
    expect(names('index')).toContain('idx_shopping_items_checked');
    expect(t.ctx.db.prepare("INSERT INTO shopping_items (name) VALUES ('x')").run().changes).toBe(1);
    expect(t.ctx.db.prepare("INSERT INTO shopping_checks (auto_key, checked_on) VALUES ('low:1:0', '2026-10-11')").run().changes).toBe(1);
  });
});

describe('the list', () => {
  it('is empty at first', async () => {
    const { list } = setup();
    expect(await list()).toEqual({ group: 'section', groups: [], counts: { open: 0, checked: 0, checked_items: 0 } });
  });

  it('shows low jars with their last purchase, and leaves out jars that are not low', async () => {
    const s = setup();
    const sup = s.supplier('Mountain Rose');
    const low = await s.jar({ name: 'Sage', amount: 5, low_threshold: 10 });
    await s.jar({ name: 'Thyme', amount: 50, low_threshold: 10 });
    await s.jar({ name: 'Mint', amount: 1, low_threshold: null });
    s.buy(low.id, { supplier_id: sup.id, price: 7.5, purchased_on: '2026-08-01' });
    s.buy(low.id, { supplier_id: sup.id, price: 9, purchased_on: '2026-09-15', quantity: 100 });
    const res = await s.list();
    expect(res.group).toBe('section');
    expect(res.counts).toEqual({ open: 1, checked: 0, checked_items: 0 });
    const section = s.r.sections.get(1);
    expect(res.groups).toEqual([{
      key: 'section-1', name: section.name, rows: [{
        key: `low:${low.id}:0`, kind: 'low', name: 'Sage', amount: 5, unit: 'g', low_threshold: 10, used_up: false,
        item: { id: low.id, name: 'Sage', live: true }, section: { id: 1, name: section.name },
        last: { supplier: { id: sup.id, name: 'Mountain Rose' }, price: 9, purchased_on: '2026-09-15', quantity: 100, unit: 'g' },
        checked: false,
      }],
    }]);
  });

  it('gives a low jar with no purchase a null last', async () => {
    const s = setup();
    await s.jar({ name: 'Sage' });
    expect((await s.list()).groups[0].rows[0].last).toBeNull();
  });

  it('shapes her items and finds last from the jar, then from the herb', async () => {
    const s = setup();
    const sup = s.supplier('Herb Shop');
    const other = s.supplier('Other Shop');
    const herb = s.herb('Calendula');
    const jar = await s.jar({ name: 'Calendula jar', amount: 80, herb_id: herb.id });
    s.buy(jar.id, { supplier_id: sup.id, price: 12, purchased_on: '2026-07-01' });
    const sibling = await s.jar({ name: 'Calendula flowers', amount: 80, herb_id: herb.id });
    s.buy(sibling.id, { supplier_id: other.id, price: 6, purchased_on: '2026-09-30', quantity: 25 });
    const sec = s.section('Wax shelf');
    const byJar = (await s.add({ name: 'Refill', item_id: jar.id, quantity: '2 bags', notes: 'organic', section_id: sec.id })).body;
    const byHerb = (await s.add({ name: 'More herb', herb_id: herb.id })).body;
    const none = (await s.add({ name: 'Beeswax' })).body;
    const bare = (await s.add({ name: 'Bare jar', item_id: (await s.jar({ name: 'Empty', amount: 90 })).id })).body;
    expect(byJar).toMatchObject({
      key: `item:${byJar.id}`, kind: 'manual', id: byJar.id, name: 'Refill', quantity: '2 bags', notes: 'organic', checked: false,
      section: { id: sec.id, name: 'Wax shelf', live: true }, supplier: null, herb: null,
      item: { id: jar.id, name: 'Calendula jar', live: true },
      last: { supplier: { id: sup.id, name: 'Herb Shop' }, price: 12, purchased_on: '2026-07-01', quantity: 50, unit: 'g' },
    });
    expect(byHerb.herb).toEqual({ id: herb.id, name: 'Calendula', live: true });
    expect(byHerb.last).toEqual({ supplier: { id: other.id, name: 'Other Shop' }, price: 6, purchased_on: '2026-09-30', quantity: 25, unit: 'g' });
    expect(none.last).toBeNull();
    expect(bare.last).toBeNull();
    const rows = (await s.list()).groups.flatMap(g => g.rows).filter(r => r.kind === 'manual');
    expect(rows.find(r => r.id === byJar.id)).toEqual(byJar);
  });

  it('groups by section with Other last, sorts groups by name and rows unchecked first', async () => {
    const s = setup();
    const zed = s.section('Zed shelf');
    const abe = s.section('Abe shelf');
    await s.add({ name: 'Wax', section_id: zed.id });
    const b = (await s.add({ name: 'Bowl', section_id: abe.id })).body;
    await s.add({ name: 'Ash', section_id: abe.id });
    await s.add({ name: 'Loose' });
    await s.h().post('/api/shopping/check').send({ key: b.key, checked: true });
    const res = await s.list();
    expect(rowNames(res)).toEqual([['Abe shelf', ['Ash', 'Bowl']], ['Zed shelf', ['Wax']], ['Other', ['Loose']]]);
    expect(res.groups.at(-1).key).toBe('other');
    expect(res.counts).toEqual({ open: 3, checked: 1, checked_items: 1 });
    await s.h().post('/api/shopping/check').send({ key: res.groups[0].rows[0].key, checked: true });
    await s.h().post('/api/shopping/check').send({ key: b.key, checked: false });
    expect(rowNames(await s.list())[0]).toEqual(['Abe shelf', ['Bowl', 'Ash']]);
  });

  it('puts a dead section in Other', async () => {
    const s = setup();
    const sec = s.section('Gone shelf');
    await s.add({ name: 'Wax', section_id: sec.id });
    s.r.sections.remove(sec.id);
    const res = await s.list();
    expect(rowNames(res)).toEqual([['Other', ['Wax']]]);
    expect(res.groups[0].rows[0].section).toEqual({ id: sec.id, name: 'Gone shelf', live: false });
  });

  it('groups by supplier: her item first, then the last purchase, then No supplier yet', async () => {
    const s = setup();
    const mine = s.supplier('Beta Co');
    const past = s.supplier('Alpha Co');
    const jar = await s.jar({ name: 'Sage' });
    s.buy(jar.id, { supplier_id: past.id });
    await s.add({ name: 'Wax', supplier_id: mine.id });
    await s.add({ name: 'Linked', item_id: jar.id });
    await s.add({ name: 'Lonely' });
    const res = await s.list('?group=supplier');
    expect(res.group).toBe('supplier');
    expect(rowNames(res)).toEqual([['Alpha Co', ['Linked']], ['Beta Co', ['Wax']], ['No supplier yet', ['Lonely']]]);
    expect(res.groups.at(-1).key).toBe('none');
  });

  it('rejects an unknown grouping', async () => {
    const s = setup();
    expect((await s.h().get('/api/shopping?group=color')).status).toBe(400);
  });

  it('does not list deleted items', async () => {
    const s = setup();
    const a = (await s.add()).body;
    await s.h().delete(`/api/shopping/items/${a.id}`);
    expect((await s.list()).groups).toEqual([]);
  });
});

describe('used-up jars', () => {
  it('go on the list by themselves, even when they were above the line', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Acacia', amount: 1, low_threshold: 0.5 });
    await s.h().patch(`/api/items/${jar.id}`).send({ used_up: true });
    const rows = (await s.list()).groups.flatMap(g => g.rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: `low:${jar.id}:0`, kind: 'low', name: 'Acacia', used_up: true });
    expect((await s.h().post('/api/shopping/check').send({ key: rows[0].key, checked: true })).status).toBe(200);
  });

  it('leave the list once restocked', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Acacia', amount: 1, low_threshold: 0.5 });
    await s.h().patch(`/api/items/${jar.id}`).send({ used_up: true });
    await s.h().post(`/api/items/${jar.id}/restock`).send({ purchased_on: '2026-10-11', quantity: 5 });
    expect((await s.list()).groups).toEqual([]);
  });
});

describe('a jar she added by hand', () => {
  it('shows once, as her item, when it is also low or used up', async () => {
    const s = setup();
    const low = await s.jar({ name: 'Sage', amount: 2, low_threshold: 10 });
    const gone = await s.jar({ name: 'Acacia', amount: 1, low_threshold: 0.5 });
    await s.add({ name: 'Sage', item_id: low.id });
    await s.add({ name: 'Acacia', item_id: gone.id });
    await s.h().patch(`/api/items/${gone.id}`).send({ used_up: true });
    const rows = (await s.list()).groups.flatMap(g => g.rows);
    expect(rows.map(r => [r.name, r.kind])).toEqual([['Acacia', 'manual'], ['Sage', 'manual']]);
    expect(rows.map(r => r.need)).toEqual([{ used_up: true }, { used_up: false, amount: 2, unit: 'g', low_threshold: 10 }]);
  });

  it('has no need while the jar is full, or once the jar is deleted', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Sage', amount: 50, low_threshold: 10 });
    await s.add({ name: 'Sage', item_id: jar.id });
    expect((await s.list()).groups[0].rows[0].need).toBeNull();
    await s.h().patch(`/api/items/${jar.id}`).send({ used_up: true });
    await s.h().delete(`/api/items/${jar.id}`);
    expect((await s.list()).groups[0].rows[0].need).toBeNull();
  });

  it('stays open, even if she checked it, while a refill leaves the jar low', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Sage', amount: 2, low_threshold: 10 });
    const added = (await s.add({ name: 'Sage', item_id: jar.id })).body;
    await s.h().post('/api/shopping/check').send({ key: `item:${added.id}`, checked: true });
    await s.h().post(`/api/items/${jar.id}/restock`).send({ purchased_on: '2026-10-11', quantity: 3 });
    expect(s.checked(added.id)).toBeNull();
    const rows = (await s.list()).groups.flatMap(g => g.rows);
    expect(rows.map(r => [r.name, r.checked, r.need])).toEqual([['Sage', false, { used_up: false, amount: 5, unit: 'g', low_threshold: 10 }]]);
  });

  it('is checked off when the jar is restocked', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Acacia', amount: 1, low_threshold: 0.5 });
    const added = (await s.add({ name: 'Acacia', item_id: jar.id })).body;
    await s.h().patch(`/api/items/${jar.id}`).send({ used_up: true });
    await s.h().post(`/api/items/${jar.id}/restock`).send({ purchased_on: '2026-10-11', quantity: 5 });
    expect(s.checked(added.id)).toBe('2026-10-11');
    const rows = (await s.list()).groups.flatMap(g => g.rows);
    expect(rows.map(r => [r.name, r.checked, r.need])).toEqual([['Acacia', true, null]]);
  });
});

describe('restocking a checked low jar', () => {
  it('comes back unchecked under a new key while still low', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Sage', amount: 2, low_threshold: 10 });
    const first = (await s.list()).groups[0].rows[0];
    expect((await s.h().post('/api/shopping/check').send({ key: first.key, checked: true })).status).toBe(200);
    expect((await s.list()).groups[0].rows[0].checked).toBe(true);
    const sup = s.supplier('Shop');
    const re = await s.h().post(`/api/items/${jar.id}/restock`).send({ supplier_id: sup.id, purchased_on: '2026-10-11', quantity: 3 });
    expect(re.status, JSON.stringify(re.body)).toBe(200);
    const row = (await s.list()).groups[0].rows[0];
    expect(row.key).toBe(`low:${jar.id}:1`);
    expect(row.checked).toBe(false);
    expect(row.last.supplier.name).toBe('Shop');
  });

  it('is gone once the restock lifts it above the line', async () => {
    const s = setup();
    const jar = await s.jar({ name: 'Sage', amount: 2, low_threshold: 10 });
    const first = (await s.list()).groups[0].rows[0];
    await s.h().post('/api/shopping/check').send({ key: first.key, checked: true });
    const sup = s.supplier('Shop');
    await s.h().post(`/api/items/${jar.id}/restock`).send({ supplier_id: sup.id, purchased_on: '2026-10-11', quantity: 100 });
    expect(await s.list()).toMatchObject({ groups: [], counts: { open: 0, checked: 0, checked_items: 0 } });
  });
});

describe('her items', () => {
  it('creates, trims and shows an item', async () => {
    const s = setup();
    const res = await s.add({ name: '  Beeswax  ', quantity: ' 1 lb ', notes: '' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ name: 'Beeswax', quantity: '1 lb', notes: null, checked: false, kind: 'manual' });
  });

  it('needs a name', async () => {
    const s = setup();
    const res = await s.add({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.details.name).toBeTruthy();
  });

  it('checks that every link is live when it is set', async () => {
    const s = setup();
    const sec = s.section('Shelf');
    const sup = s.supplier('Shop');
    const herb = s.herb('Sage');
    const jar = await s.jar();
    for (const [field, rec, table] of [['section_id', sec, 'sections'], ['supplier_id', sup, 'suppliers'], ['herb_id', herb, 'herbs']]) {
      s.r[table].remove(rec.id);
      const res = await s.add({ [field]: rec.id });
      expect(res.status, field).toBe(400);
      expect(res.body.details[field]).toBeTruthy();
    }
    await s.h().delete(`/api/items/${jar.id}`);
    const res = await s.add({ item_id: jar.id });
    expect(res.status).toBe(400);
    expect(res.body.details.item_id).toBeTruthy();
    expect((await s.add({ item_id: 99999 })).status).toBe(400);
  });

  it('accepts an unchanged link to a record deleted later, and refuses a new dead one', async () => {
    const s = setup();
    const sup = s.supplier('Shop');
    const herb = s.herb('Sage');
    const a = (await s.add({ name: 'Wax', supplier_id: sup.id, herb_id: herb.id })).body;
    s.r.suppliers.remove(sup.id);
    const ok = await s.h().patch(`/api/shopping/items/${a.id}`).send({ name: 'Wax pellets', supplier_id: sup.id });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body).toMatchObject({ name: 'Wax pellets', supplier: { id: sup.id, name: 'Shop', live: false } });
    const sup2 = s.supplier('New shop');
    s.r.suppliers.remove(sup2.id);
    const bad = await s.h().patch(`/api/shopping/items/${a.id}`).send({ supplier_id: sup2.id });
    expect(bad.status).toBe(400);
    expect(bad.body.details.supplier_id).toBeTruthy();
    const cleared = await s.h().patch(`/api/shopping/items/${a.id}`).send({ supplier_id: null });
    expect(cleared.body.supplier).toBeNull();
  });

  it('updates part of an item and 404s on a missing one', async () => {
    const s = setup();
    const a = (await s.add({ name: 'Wax', quantity: '1' })).body;
    const res = await s.h().patch(`/api/shopping/items/${a.id}`).send({ notes: 'unbleached' });
    expect(res.body).toMatchObject({ name: 'Wax', quantity: '1', notes: 'unbleached' });
    expect((await s.h().patch('/api/shopping/items/9999').send({ name: 'x' })).status).toBe(404);
    expect((await s.h().patch(`/api/shopping/items/${a.id}`).send({ name: '' })).status).toBe(400);
  });

  it('deletes and restores', async () => {
    const s = setup();
    const a = (await s.add()).body;
    const del = await s.h().delete(`/api/shopping/items/${a.id}`);
    expect(del.body).toEqual({ ok: true, restore: `/api/shopping/items/${a.id}/restore` });
    expect((await s.h().delete(`/api/shopping/items/${a.id}`)).status).toBe(404);
    const back = await s.h().post(`/api/shopping/items/${a.id}/restore`);
    expect(back.status).toBe(200);
    expect(back.body.name).toBe('Beeswax');
    expect((await s.list()).groups).toHaveLength(1);
    expect((await s.h().post(`/api/shopping/items/${a.id}/restore`)).status).toBe(404);
  });
});

describe('checking', () => {
  it('checks and unchecks her item, stamping the local day', async () => {
    const s = setup();
    const a = (await s.add()).body;
    const on = await s.h().post('/api/shopping/check').send({ key: a.key, checked: true });
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    expect(s.checked(a.id)).toBe(localToday());
    expect((await s.list()).counts).toEqual({ open: 0, checked: 1, checked_items: 1 });
    await s.h().post('/api/shopping/check').send({ key: a.key, checked: false });
    expect(s.checked(a.id)).toBeNull();
  });

  it('checks and unchecks a low jar through shopping_checks', async () => {
    const s = setup();
    const jar = await s.jar();
    const key = `low:${jar.id}:0`;
    await s.h().post('/api/shopping/check').send({ key, checked: true });
    expect(s.db.prepare('SELECT auto_key FROM shopping_checks').all()).toEqual([{ auto_key: key }]);
    await s.h().post('/api/shopping/check').send({ key, checked: true });
    expect(s.db.prepare('SELECT COUNT(*) n FROM shopping_checks').get().n).toBe(1);
    expect((await s.list()).counts).toEqual({ open: 0, checked: 1, checked_items: 0 });
    await s.h().post('/api/shopping/check').send({ key, checked: false });
    expect(s.db.prepare('SELECT COUNT(*) n FROM shopping_checks').get().n).toBe(0);
  });

  it('404s on a stale or unknown key, and 400s on a bad body', async () => {
    const s = setup();
    const jar = await s.jar();
    const post = body => s.h().post('/api/shopping/check').send(body);
    expect((await post({ key: `low:${jar.id}:7`, checked: true })).status).toBe(404);
    expect((await post({ key: 'low:9999:0', checked: true })).status).toBe(404);
    expect((await post({ key: 'item:9999', checked: true })).status).toBe(404);
    expect((await post({ key: 'what', checked: true })).status).toBe(400);
    expect((await post({ checked: true })).status).toBe(400);
    expect((await post({ key: `low:${jar.id}:0` })).status).toBe(400);
    expect(s.db.prepare('SELECT COUNT(*) n FROM shopping_checks').get().n).toBe(0);
  });
});

describe('shopping_item_id on a new jar', () => {
  it('ignores values that are not a positive whole number', async () => {
    const s = setup();
    const a = (await s.add()).body;
    for (const bad of [true, String(a.id), [a.id], 1.5, -1]) {
      const res = await s.h().post('/api/items').send({ section_id: 1, name: 'Sage', unit: 'g', amount: 30, shopping_item_id: bad });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(s.checked(a.id)).toBeNull();
    }
  });
});

describe('stale low checks', () => {
  it('forgets a check once the jar is no longer low, so a later dip starts unchecked', async () => {
    const s = setup();
    const jar = await s.jar();
    await s.h().post('/api/shopping/check').send({ key: `low:${jar.id}:0`, checked: true });
    expect((await s.list()).counts.checked).toBe(1);
    await s.h().patch(`/api/items/${jar.id}`).send({ amount: 50 });
    expect((await s.list()).groups).toEqual([]);
    await s.h().patch(`/api/items/${jar.id}`).send({ amount: 3 });
    const res = await s.list();
    expect(res.counts).toEqual({ open: 1, checked: 0, checked_items: 0 });
    expect(res.groups[0].rows[0].checked).toBe(false);
  });
});

describe('clearing', () => {
  it('soft-deletes checked items with one stamp, drops stale checks, and undoes', async () => {
    const s = setup();
    const a = (await s.add({ name: 'A' })).body;
    const b = (await s.add({ name: 'B' })).body;
    await s.add({ name: 'C' });
    const jar = await s.jar();
    await s.h().post('/api/shopping/check').send({ key: a.key, checked: true });
    await s.h().post('/api/shopping/check').send({ key: b.key, checked: true });
    await s.h().post('/api/shopping/check').send({ key: `low:${jar.id}:0`, checked: true });
    s.db.prepare("INSERT INTO shopping_checks (auto_key, checked_on) VALUES ('low:9999:0', '2026-10-01')").run();
    const res = await s.h().post('/api/shopping/clear');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.cleared).toBe(2);
    expect(typeof res.body.stamp).toBe('string');
    const stamps = s.db.prepare('SELECT DISTINCT deleted_at FROM shopping_items WHERE deleted_at IS NOT NULL').all();
    expect(stamps).toEqual([{ deleted_at: res.body.stamp }]);
    expect(s.db.prepare('SELECT auto_key FROM shopping_checks').all()).toEqual([{ auto_key: `low:${jar.id}:0` }]);
    expect((await s.list()).counts).toEqual({ open: 1, checked: 1, checked_items: 0 });
    const undo = await s.h().post('/api/shopping/clear/undo').send({ stamp: res.body.stamp });
    expect(undo.status, JSON.stringify(undo.body)).toBe(200);
    expect((await s.list()).counts).toEqual({ open: 1, checked: 3, checked_items: 2 });
    expect((await s.h().post('/api/shopping/clear/undo').send({ stamp: res.body.stamp })).status).toBe(404);
    expect((await s.h().post('/api/shopping/clear/undo').send({})).status).toBe(400);
  });

  it('does not bring back an item she deleted herself when undoing a clear', async () => {
    const s = setup();
    const a = (await s.add({ name: 'A' })).body;
    const b = (await s.add({ name: 'B' })).body;
    await s.h().post('/api/shopping/check').send({ key: b.key, checked: true });
    await s.h().post('/api/shopping/check').send({ key: a.key, checked: true });
    await s.h().delete(`/api/shopping/items/${a.id}`);
    const res = await s.h().post('/api/shopping/clear');
    expect(res.body.cleared).toBe(1);
    await s.h().post('/api/shopping/clear/undo').send({ stamp: res.body.stamp });
    expect((await s.list()).groups.flatMap(g => g.rows).map(r => r.name)).toEqual(['B']);
  });

  it('clears nothing cleanly', async () => {
    const s = setup();
    const res = await s.h().post('/api/shopping/clear');
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(0);
  });
});

describe('jar prefill', () => {
  it('builds the jar form from her item and its last purchase', async () => {
    const s = setup();
    const sup = s.supplier('Shop');
    const herb = s.herb('Sage');
    const sec = s.section('Shelf');
    const jar = await s.jar({ herb_id: herb.id });
    s.buy(jar.id, { supplier_id: sup.id, price: 8.5 });
    const a = (await s.add({ name: 'Sage refill', herb_id: herb.id, section_id: sec.id })).body;
    const res = await s.h().get(`/api/shopping/items/${a.id}/jar`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual({
      name: 'Sage refill', latin_name: 'Sage latinus', herb_id: herb.id, section_id: sec.id, source_kind: 'bought',
      purchase: { supplier_id: sup.id, price: 8.5 },
    });
  });

  it('leaves out dead links and null fields', async () => {
    const s = setup();
    const sup = s.supplier('Shop');
    const herb = s.herb('Sage');
    const sec = s.section('Shelf');
    const jar = await s.jar({ herb_id: herb.id });
    s.buy(jar.id, { supplier_id: sup.id, price: null });
    const a = (await s.add({ name: 'Sage refill', herb_id: herb.id, section_id: sec.id, item_id: jar.id })).body;
    s.r.herbs.remove(herb.id);
    s.r.sections.remove(sec.id);
    s.r.suppliers.remove(sup.id);
    expect((await s.h().get(`/api/shopping/items/${a.id}/jar`)).body).toEqual({ name: 'Sage refill', source_kind: 'bought' });
    const plain = (await s.add({ name: 'Wax' })).body;
    expect((await s.h().get(`/api/shopping/items/${plain.id}/jar`)).body).toEqual({ name: 'Wax', source_kind: 'bought' });
  });

  it('borrows the herb and Latin name from the linked live jar when the item has no herb', async () => {
    const s = setup();
    const herb = s.herb('Sage');
    const jar = await s.jar({ herb_id: herb.id });
    const a = (await s.add({ name: 'Sage refill', item_id: jar.id })).body;
    const out = (await s.h().get(`/api/shopping/items/${a.id}/jar`)).body;
    expect(out).toMatchObject({ name: 'Sage refill', herb_id: herb.id, latin_name: 'Sage latinus' });
    s.r.herbs.remove(herb.id);
    expect((await s.h().get(`/api/shopping/items/${a.id}/jar`)).body).toEqual({ name: 'Sage refill', source_kind: 'bought' });
  });

  it('keeps a live supplier without a price', async () => {
    const s = setup();
    const sup = s.supplier('Shop');
    const a = (await s.add({ name: 'Wax', supplier_id: sup.id })).body;
    const jar = (await s.h().get(`/api/shopping/items/${a.id}/jar`)).body;
    expect(jar).toEqual({ name: 'Wax', source_kind: 'bought', purchase: { supplier_id: sup.id } });
  });

  it('404s for a missing item', async () => {
    const s = setup();
    expect((await s.h().get('/api/shopping/items/9999/jar')).status).toBe(404);
  });
});

describe('making a jar from a shopping item', () => {
  it('checks the item off with the jar acquired date', async () => {
    const s = setup();
    const a = (await s.add({ name: 'Sage' })).body;
    const res = await s.h().post('/api/items').send({ section_id: 1, name: 'Sage', unit: 'g', amount: 30, acquired_on: '2026-10-05', shopping_item_id: a.id });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(s.checked(a.id)).toBe('2026-10-05');
  });

  it('uses the local day without an acquired date, and ignores an item that is gone', async () => {
    const s = setup();
    const a = (await s.add({ name: 'Sage' })).body;
    const gone = (await s.add({ name: 'Old' })).body;
    await s.h().delete(`/api/shopping/items/${gone.id}`);
    const res = await s.h().post('/api/items').send({ section_id: 1, name: 'Sage', unit: 'g', amount: 30, shopping_item_id: a.id });
    expect(res.status).toBe(201);
    expect(s.checked(a.id)).toBe(localToday());
    const res2 = await s.h().post('/api/items').send({ section_id: 1, name: 'Old', unit: 'g', amount: 30, shopping_item_id: gone.id });
    expect(res2.status).toBe(201);
    expect(s.checked(gone.id)).toBeNull();
  });

  it('does not check the item off when the jar fails to save', async () => {
    const s = setup();
    const a = (await s.add({ name: 'Sage' })).body;
    const res = await s.h().post('/api/items').send({ section_id: 1, name: '', unit: 'g', amount: 30, shopping_item_id: a.id });
    expect(res.status).toBe(400);
    expect(s.checked(a.id)).toBeNull();
  });
});
