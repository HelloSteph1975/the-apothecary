import { HttpError, notFound } from '../http.js';
import { check } from '../validate.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { itemSchema, purchaseSchema, restockSchema } from '../schemas.js';
import { addDays, addMonths, isDate } from '../lib/dates.js';

export const EXPIRY_KEYS = {
  'dried leaf': 'expiry_dried_leaf', 'dried flower': 'expiry_dried_flower', root: 'expiry_root', bark: 'expiry_bark',
  seed: 'expiry_seed', resin: 'expiry_resin', powder: 'expiry_powder', tincture: 'expiry_tincture', oil: 'expiry_oil',
};

// Months until a form is past its best; 0 or a missing key means "no suggestion".
export function suggestExpiry(form, acquiredOn, settings) {
  const key = EXPIRY_KEYS[form];
  const months = key ? Number(settings[key]) : 0;
  if (!months || !isDate(acquiredOn)) return null;
  return addMonths(acquiredOn, months);
}

export function itemStatus(row, today) {
  const live = !row.used_up_at;
  return {
    low: live && row.low_threshold != null && row.amount <= row.low_threshold,
    expiring: live && row.expires_on != null && row.expires_on >= today && row.expires_on <= addDays(today, 30),
    expired: live && row.expires_on != null && row.expires_on < today,
  };
}

const LIST_SQL = `
  SELECT i.*, s.name AS section_name, s.kind AS section_kind, s.sort_order AS section_order,
    (SELECT filename FROM photos p WHERE p.owner_type = 'item' AND p.owner_id = i.id AND p.deleted_at IS NULL
      ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1) AS cover,
    lp.purchased_on AS last_purchased_on, lp.price AS last_price, lp.quantity AS last_quantity,
    lp.supplier_id AS last_supplier_id, sup.name AS last_supplier_name
  FROM items i
  JOIN cabinet_sections s ON s.id = i.section_id
  LEFT JOIN purchases lp ON lp.id = (SELECT id FROM purchases WHERE item_id = i.id AND deleted_at IS NULL ORDER BY purchased_on DESC, id DESC LIMIT 1)
  LEFT JOIN suppliers sup ON sup.id = lp.supplier_id
  WHERE i.deleted_at IS NULL`;

export function listItems(db, f, today) {
  const where = [];
  const args = [];
  if (!f.include_used_up) where.push('i.used_up_at IS NULL');
  for (const key of ['section_id', 'source_kind', 'form', 'plant_part', 'storage_spot']) {
    if (f[key] != null && f[key] !== '') { where.push(`i.${key} = ?`); args.push(f[key]); }
  }
  if (f.q) { where.push('(i.name LIKE ? OR i.latin_name LIKE ?)'); args.push(`%${f.q}%`, `%${f.q}%`); }
  if (f.supplier_id) {
    where.push('EXISTS (SELECT 1 FROM purchases px WHERE px.item_id = i.id AND px.deleted_at IS NULL AND px.supplier_id = ?)');
    args.push(Number(f.supplier_id));
  }
  if (f.status === 'low') where.push('i.low_threshold IS NOT NULL AND i.amount <= i.low_threshold');
  if (f.status === 'expiring') { where.push('i.expires_on >= ? AND i.expires_on <= ?'); args.push(today, addDays(today, 30)); }
  if (f.status === 'expired') { where.push('i.expires_on < ?'); args.push(today); }
  const sql = `${LIST_SQL}${where.map(w => ` AND ${w}`).join('')} ORDER BY s.sort_order, s.id, i.name COLLATE NOCASE`;
  return db.prepare(sql).all(...args).map(r => ({ ...r, status: itemStatus(r, today) }));
}

export function getItemDetail(db, id, today) {
  const row = db.prepare(`${LIST_SQL} AND i.id = ?`).get(id);
  if (!row) throw notFound('That item is not in the cabinet.');
  const purchases = db.prepare(`SELECT p.*, s.name AS supplier_name, s.deleted_at AS supplier_deleted_at
    FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.item_id = ? AND p.deleted_at IS NULL ORDER BY p.purchased_on DESC, p.id DESC`).all(id);
  const photos = repos(db).photos.list({ owner_type: 'item', owner_id: id });
  return { ...row, status: itemStatus(row, today), purchases, photos };
}

function assertLive(db, table, id, field, label) {
  if (id == null) return;
  if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id)) {
    throw new HttpError(400, 'Please fix the highlighted fields.', { [field]: `That ${label} doesn't exist` });
  }
}

function itemData(input, { partial }) {
  const { used_up, ...data } = check(itemSchema, input, { partial });
  if (used_up !== undefined) data.used_up_at = used_up ? new Date().toISOString() : null;
  return data;
}

export function createItem(db, body) {
  const data = itemData(body, { partial: false });
  assertLive(db, 'cabinet_sections', data.section_id, 'section_id', 'section');
  const purchase = body?.purchase && data.source_kind === 'bought' ? check(purchaseSchema, { quantity: data.amount, ...body.purchase }) : null;
  if (purchase) assertLive(db, 'suppliers', purchase.supplier_id, 'supplier_id', 'supplier');
  return transaction(db, () => {
    const r = repos(db);
    const item = r.items.create(data);
    if (purchase) r.purchases.create({ ...purchase, item_id: item.id, unit: item.unit });
    return item;
  });
}

export function updateItem(db, id, body) {
  const r = repos(db);
  if (!r.items.get(id)) throw notFound('That item is not in the cabinet.');
  const data = itemData(body, { partial: true });
  assertLive(db, 'cabinet_sections', data.section_id, 'section_id', 'section');
  return r.items.update(id, data);
}

export function restockItem(db, id, body) {
  const r = repos(db);
  const item = r.items.get(id);
  if (!item) throw notFound('That item is not in the cabinet.');
  const { expires_on, ...purchase } = check(restockSchema, body);
  assertLive(db, 'suppliers', purchase.supplier_id, 'supplier_id', 'supplier');
  return transaction(db, () => {
    r.purchases.create({ ...purchase, item_id: id, unit: item.unit });
    const changes = { amount: item.amount + purchase.quantity, used_up_at: null };
    if (!item.source_kind) changes.source_kind = 'bought';
    if (expires_on !== undefined) changes.expires_on = expires_on;
    return r.items.update(id, changes);
  });
}

export function storageSpots(db) {
  return db.prepare(`SELECT DISTINCT storage_spot FROM items WHERE deleted_at IS NULL AND storage_spot IS NOT NULL
    ORDER BY storage_spot COLLATE NOCASE`).all().map(r => r.storage_spot);
}

// Sections ---------------------------------------------------------------

export function deleteSection(db, id, moveTo, stamp) {
  const r = repos(db);
  const section = r.sections.get(id);
  if (!section) throw notFound('That section is gone.');
  const count = db.prepare('SELECT COUNT(*) n FROM items WHERE section_id = ? AND deleted_at IS NULL').get(id).n;
  if (count && !moveTo) throw new HttpError(409, 'Move what is in this section first.', { items: count });
  if (moveTo) {
    if (Number(moveTo) === id) throw new HttpError(400, 'Pick a different section to move things into.');
    assertLive(db, 'cabinet_sections', Number(moveTo), 'move_to', 'section');
  }
  transaction(db, () => {
    if (moveTo) db.prepare("UPDATE items SET section_id = ?, updated_at = datetime('now') WHERE section_id = ? AND deleted_at IS NULL").run(Number(moveTo), id);
    r.sections.remove(id, stamp);
  });
}

export function reorderSections(db, ids) {
  if (!Array.isArray(ids) || !ids.every(n => Number.isInteger(n))) throw new HttpError(400, 'Send the section ids in their new order.');
  const r = repos(db);
  transaction(db, () => ids.forEach((id, i) => r.sections.update(id, { sort_order: i })));
  return r.sections.list();
}
