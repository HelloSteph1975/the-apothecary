import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';

let t;
afterEach(() => t?.cleanup());

it('seeds the fifteen starter sections in order, Herbs first', () => {
  t = makeTestContext();
  const rows = repos(t.ctx.db).sections.list();
  expect(rows.map(r => r.name)).toEqual([
    'Herbs', 'Oils and butters', 'Waxes', 'Alcohol and vinegars', 'Honey and sweeteners', 'Essential oils',
    'Salts and minerals', 'Resins and incense', 'Candles', 'Crystals and stones', 'Containers',
    'Labels and packaging', 'Cloth and bags', 'Tools and equipment', 'Other',
  ]);
  expect(rows[0].kind).toBe('herb');
  expect(rows.slice(1).every(r => r.kind === 'supply')).toBe(true);
});

it('stores an item, a supplier and a purchase, and soft-deletes', () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const sup = r.suppliers.create({ name: 'Moonvale Botanicals', rating: 5 });
  const item = r.items.create({ section_id: 11, name: 'Amber dropper bottle', size_label: '30 ml', amount: 24, unit: 'count', low_threshold: 6 });
  r.purchases.create({ item_id: item.id, supplier_id: sup.id, purchased_on: '2026-10-01', quantity: 24, unit: 'count', price: 18.5 });
  expect(r.purchases.list({ item_id: item.id })).toHaveLength(1);
  expect(r.items.remove(item.id)).toBe(true);
  expect(r.items.get(item.id)).toBeNull();
  expect(r.items.restore(item.id)).toBe(true);
  expect(r.items.get(item.id).name).toBe('Amber dropper bottle');
});

it('rejects values outside the allowed lists at the database level', () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  expect(() => r.items.create({ section_id: 1, name: 'X', unit: 'cups' })).toThrow();
  expect(() => r.items.create({ section_id: 1, name: 'X', form: 'liquid' })).toThrow();
  expect(() => r.items.create({ section_id: 1, name: 'X', source_kind: 'stolen' })).toThrow();
  expect(() => r.suppliers.create({ name: 'Y', rating: 6 })).toThrow();
});
