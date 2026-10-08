import { createRepo } from './repo.js';

const cache = new WeakMap();

export function repos(db) {
  let r = cache.get(db);
  if (!r) {
    r = {
      sections: createRepo(db, 'cabinet_sections', ['name', 'kind', 'sort_order'], { orderBy: 'sort_order, id' }),
      suppliers: createRepo(db, 'suppliers', ['name', 'website', 'contact', 'good_for', 'rating', 'notes'], { orderBy: 'name COLLATE NOCASE' }),
      items: createRepo(db, 'items', ['section_id', 'name', 'latin_name', 'herb_id', 'form', 'plant_part', 'size_label', 'amount', 'unit',
        'low_threshold', 'acquired_on', 'expires_on', 'storage_spot', 'source_kind', 'source_place', 'source_from', 'notes', 'used_up_at'],
        { orderBy: 'name COLLATE NOCASE' }),
      purchases: createRepo(db, 'purchases', ['item_id', 'supplier_id', 'purchased_on', 'quantity', 'unit', 'price', 'order_note'],
        { orderBy: 'purchased_on DESC, id DESC' }),
      photos: createRepo(db, 'photos', ['owner_type', 'owner_id', 'filename', 'caption', 'is_cover', 'sort_order'], { orderBy: 'is_cover DESC, sort_order, id' }),
    };
    cache.set(db, r);
  }
  return r;
}
