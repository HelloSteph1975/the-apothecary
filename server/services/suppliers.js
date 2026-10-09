import { notFound } from '../http.js';
import { repos } from '../db/repos.js';

export function listSuppliers(db) {
  return db.prepare(`SELECT s.*,
      (SELECT COUNT(*) FROM purchases p JOIN items i ON i.id = p.item_id
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND i.deleted_at IS NULL) AS purchase_count,
      (SELECT COALESCE(SUM(p.price), 0) FROM purchases p JOIN items i ON i.id = p.item_id
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND i.deleted_at IS NULL) AS total_spent,
      (SELECT MAX(p.purchased_on) FROM purchases p JOIN items i ON i.id = p.item_id
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND i.deleted_at IS NULL) AS last_purchased_on,
      (SELECT filename FROM photos ph WHERE ph.owner_type = 'supplier' AND ph.owner_id = s.id AND ph.deleted_at IS NULL
        ORDER BY ph.is_cover DESC, ph.sort_order, ph.id LIMIT 1) AS cover
    FROM suppliers s WHERE s.deleted_at IS NULL ORDER BY s.name COLLATE NOCASE`).all();
}

export function getSupplierDetail(db, id) {
  const s = repos(db).suppliers.get(id);
  if (!s) throw notFound('That supplier is gone.');
  const purchases = db.prepare(`SELECT p.*, i.name AS item_name, i.unit AS item_unit, i.size_label AS item_size
    FROM purchases p JOIN items i ON i.id = p.item_id
    WHERE p.supplier_id = ? AND p.deleted_at IS NULL AND i.deleted_at IS NULL
    ORDER BY p.purchased_on DESC, p.id DESC`).all(id);
  const photos = repos(db).photos.list({ owner_type: 'supplier', owner_id: id });
  return { ...s, purchases, photos };
}
