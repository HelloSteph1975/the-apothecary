import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { validate } from '../validate.js';
import { shoppingItemSchema } from '../schemas.js';
import { listItems } from './cabinet.js';
import { localToday } from './timing.js';

const ITEM_GONE = 'That item is not on the shopping list.';
const FIX = 'Please fix the highlighted fields.';
const GROUPS = ['section', 'supplier'];
const LINKS = [['section_id', 'cabinet_sections', 'section'], ['supplier_id', 'suppliers', 'supplier'], ['herb_id', 'herbs', 'herb'], ['item_id', 'items', 'jar']];
const LOW_KEY = /^low:(\d+):(\d+)$/;
const ITEM_KEY = /^item:(\d+)$/;

const isLive = (db, table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id));
const ref = (id, name, deletedAt) => (id == null ? null : { id, name, live: deletedAt == null });
const byText = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });

// The latest purchase, shaped for the list. A supplier that has since been deleted shows as no supplier.
function shapeLast(p) {
  if (!p) return null;
  return {
    supplier: p.supplier_id != null && p.supplier_deleted == null ? { id: p.supplier_id, name: p.supplier_name } : null,
    price: p.price, purchased_on: p.purchased_on, quantity: p.quantity, unit: p.unit,
  };
}

const PURCHASE_SELECT = `SELECT p.*, s.name AS supplier_name, s.deleted_at AS supplier_deleted FROM purchases p
  LEFT JOIN suppliers s ON s.id = p.supplier_id`;

const lastForJar = (db, itemId) => shapeLast(db.prepare(`${PURCHASE_SELECT}
  WHERE p.item_id = ? AND p.deleted_at IS NULL ORDER BY p.purchased_on DESC, p.id DESC LIMIT 1`).get(itemId));

const lastForHerb = (db, herbId) => shapeLast(db.prepare(`${PURCHASE_SELECT}
  JOIN items i ON i.id = p.item_id AND i.deleted_at IS NULL
  WHERE i.herb_id = ? AND p.deleted_at IS NULL ORDER BY p.purchased_on DESC, p.id DESC LIMIT 1`).get(herbId));

// The jar's own purchases first, then any jar of the same herb. A link that is no longer live adds nothing.
function lastFor(db, row) {
  const jar = row.item_id != null && row.item_deleted == null ? lastForJar(db, row.item_id) : null;
  if (jar) return jar;
  return row.herb_id != null && row.herb_deleted == null ? lastForHerb(db, row.herb_id) : null;
}

const MANUAL_SELECT = `SELECT w.*, sec.name AS section_name, sec.deleted_at AS section_deleted,
  sup.name AS supplier_name, sup.deleted_at AS supplier_deleted, h.common_name AS herb_name, h.deleted_at AS herb_deleted,
  it.name AS item_name, it.deleted_at AS item_deleted, it.amount AS item_amount, it.unit AS item_unit,
  it.low_threshold AS item_low_threshold, it.used_up_at AS item_used_up_at
  FROM shopping_items w
  LEFT JOIN cabinet_sections sec ON sec.id = w.section_id
  LEFT JOIN suppliers sup ON sup.id = w.supplier_id
  LEFT JOIN herbs h ON h.id = w.herb_id
  LEFT JOIN items it ON it.id = w.item_id`;

// How the linked jar stands, when it is live and low or used up; otherwise null.
function jarNeed(w) {
  if (w.item_id == null || w.item_deleted != null) return null;
  if (w.item_used_up_at) return { used_up: true };
  if (w.item_low_threshold != null && w.item_amount <= w.item_low_threshold) {
    return { used_up: false, amount: w.item_amount, unit: w.item_unit, low_threshold: w.item_low_threshold };
  }
  return null;
}

function shapeManual(db, w) {
  return {
    key: `item:${w.id}`, kind: 'manual', id: w.id, name: w.name, quantity: w.quantity, notes: w.notes,
    section: ref(w.section_id, w.section_name, w.section_deleted),
    supplier: ref(w.supplier_id, w.supplier_name, w.supplier_deleted),
    herb: ref(w.herb_id, w.herb_name, w.herb_deleted),
    item: ref(w.item_id, w.item_name, w.item_deleted),
    need: jarNeed(w), last: lastFor(db, w), checked: w.checked_on != null,
  };
}

const lowKey = i => `low:${i.id}:${i.restock_count}`;
// Low and used-up jars, less any she already put on the list by hand, so a jar shows once.
function lowJars(db) {
  const byHand = new Set(db.prepare('SELECT item_id FROM shopping_items WHERE item_id IS NOT NULL AND deleted_at IS NULL').all().map(r => r.item_id));
  return listItems(db, { status: 'needed' }, localToday()).filter(i => !byHand.has(i.id));
}

function shapeLow(db, i, checks) {
  const key = lowKey(i);
  return {
    key, kind: 'low', name: i.name, amount: i.amount, unit: i.unit, low_threshold: i.low_threshold, used_up: Boolean(i.used_up_at),
    item: { id: i.id, name: i.name, live: true }, section: { id: i.section_id, name: i.section_name },
    last: lastForJar(db, i.id), checked: checks.has(key),
  };
}

function groupOf(row, group) {
  if (group === 'section') {
    const s = row.section && row.section.live !== false ? row.section : null;
    return s ? { key: `section-${s.id}`, name: s.name } : { key: 'other', name: 'Other', last: true };
  }
  const s = (row.supplier && row.supplier.live ? row.supplier : null) ?? row.last?.supplier ?? null;
  return s ? { key: `supplier-${s.id}`, name: s.name } : { key: 'none', name: 'No supplier yet', last: true };
}

const fail = errors => { throw new HttpError(400, FIX, errors); };

// A check belongs to one low spell. Once a jar is off the list its check goes too, so a later dip starts unchecked.
function forgetStaleChecks(db, keys) {
  const drop = db.prepare('DELETE FROM shopping_checks WHERE auto_key = ?');
  for (const { auto_key } of db.prepare('SELECT auto_key FROM shopping_checks').all()) {
    if (!keys.has(auto_key)) drop.run(auto_key);
  }
}

export function getShoppingList(db, { group = 'section' } = {}) {
  if (!GROUPS.includes(group)) fail({ group: `Must be one of: ${GROUPS.join(', ')}` });
  const low = lowJars(db);
  forgetStaleChecks(db, new Set(low.map(lowKey)));
  const checks = new Set(db.prepare('SELECT auto_key FROM shopping_checks').all().map(r => r.auto_key));
  const rows = [
    ...low.map(i => shapeLow(db, i, checks)),
    ...db.prepare(`${MANUAL_SELECT} WHERE w.deleted_at IS NULL`).all().map(w => shapeManual(db, w)),
  ];
  const groups = new Map();
  for (const row of rows) {
    const g = groupOf(row, group);
    if (!groups.has(g.key)) groups.set(g.key, { key: g.key, name: g.name, last: Boolean(g.last), rows: [] });
    groups.get(g.key).rows.push(row);
  }
  const sorted = [...groups.values()].sort((a, b) => Number(a.last) - Number(b.last) || byText(a.name, b.name) || byText(a.key, b.key));
  for (const g of sorted) {
    g.rows.sort((a, b) => Number(a.checked) - Number(b.checked) || byText(a.name, b.name) || byText(a.key, b.key));
  }
  const checked = rows.filter(r => r.checked).length;
  return {
    group, groups: sorted.map(({ key, name, rows: r }) => ({ key, name, rows: r })),
    counts: { open: rows.length - checked, checked, checked_items: rows.filter(r => r.kind === 'manual' && r.checked).length },
  };
}

// Her items --------------------------------------------------------------------

function getRow(db, id) {
  const w = db.prepare(`${MANUAL_SELECT} WHERE w.id = ? AND w.deleted_at IS NULL`).get(id);
  if (!w) throw notFound(ITEM_GONE);
  return w;
}

export const getShoppingItem = (db, id) => shapeManual(db, getRow(db, id));

function parseInput(db, body, { partial, existing }) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const { data = {}, errors = {} } = validate(shoppingItemSchema, src, { partial });
  // A link only has to be live when it changes; a record deleted after she linked it stays linked.
  for (const [field, table, label] of LINKS) {
    if (data[field] != null && data[field] !== existing?.[field] && !errors[field] && !isLive(db, table, data[field])) {
      errors[field] = `That ${label} doesn't exist`;
    }
  }
  if (Object.keys(errors).length) fail(errors);
  return data;
}

export function createShoppingItem(db, body) {
  const data = parseInput(db, body, { partial: false, existing: null });
  return repos(db).shoppingItems.create(data).id;
}

export function updateShoppingItem(db, id, body) {
  const r = repos(db);
  const existing = r.shoppingItems.get(id);
  if (!existing) throw notFound(ITEM_GONE);
  r.shoppingItems.update(id, parseInput(db, body, { partial: true, existing }));
  return id;
}

export function deleteShoppingItem(db, id, stamp) {
  if (!repos(db).shoppingItems.remove(id, stamp)) throw notFound(ITEM_GONE);
}

export function restoreShoppingItem(db, id) {
  repos(db).shoppingItems.restore(id);
}

// Checks ---------------------------------------------------------------------

export function setChecked(db, key, checked) {
  const low = typeof key === 'string' ? LOW_KEY.exec(key) : null;
  const mine = typeof key === 'string' ? ITEM_KEY.exec(key) : null;
  if (!low && !mine) fail({ key: 'That is not a shopping list entry' });
  const today = localToday();
  if (mine) {
    const id = Number(mine[1]);
    if (!repos(db).shoppingItems.get(id)) throw notFound(ITEM_GONE);
    repos(db).shoppingItems.update(id, { checked_on: checked ? today : null });
    return;
  }
  if (!lowJars(db).some(i => lowKey(i) === key)) throw notFound('That jar is no longer on the list.');
  if (checked) db.prepare('INSERT OR REPLACE INTO shopping_checks (auto_key, checked_on) VALUES (?, ?)').run(key, today);
  else db.prepare('DELETE FROM shopping_checks WHERE auto_key = ?').run(key);
}

// Soft-deletes every checked item with one stamp, and forgets checks whose jar is no longer low under that key.
export function clearChecked(db) {
  const stamp = new Date().toISOString();
  return transaction(db, () => {
    const cleared = db.prepare('UPDATE shopping_items SET deleted_at = ? WHERE checked_on IS NOT NULL AND deleted_at IS NULL').run(stamp).changes;
    forgetStaleChecks(db, new Set(lowJars(db).map(lowKey)));
    return { stamp, cleared };
  });
}

export function undoClear(db, stamp) {
  if (typeof stamp !== 'string' || stamp === '') fail({ stamp: 'Required' });
  const restored = db.prepare('UPDATE shopping_items SET deleted_at = NULL WHERE deleted_at = ?').run(stamp).changes;
  if (!restored) throw notFound('Nothing to undo');
  return { restored };
}

// What a jar made from this item starts with. Links that are gone and empty fields are left out.
export function jarPrefill(db, id) {
  const w = getRow(db, id);
  const last = lastFor(db, w);
  let herb = w.herb_id != null && w.herb_deleted == null ? repos(db).herbs.get(w.herb_id) : null;
  if (!herb && w.item_id != null && w.item_deleted == null) {
    // No herb of its own: borrow the live herb of the jar it points at.
    const viaJar = db.prepare('SELECT i.herb_id FROM items i JOIN herbs h ON h.id = i.herb_id AND h.deleted_at IS NULL WHERE i.id = ?').get(w.item_id);
    if (viaJar) herb = repos(db).herbs.get(viaJar.herb_id);
  }
  const purchase = Object.fromEntries(Object.entries({
    supplier_id: w.supplier_id != null && w.supplier_deleted == null ? w.supplier_id : last?.supplier?.id, price: last?.price,
  }).filter(([, v]) => v != null));
  const out = {
    name: w.name, latin_name: herb?.latin_name, herb_id: herb?.id,
    section_id: w.section_id != null && w.section_deleted == null ? w.section_id : null,
    source_kind: 'bought', purchase: Object.keys(purchase).length ? purchase : null,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}
