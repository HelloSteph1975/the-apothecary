export const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'fl oz', 'count'];
export const FORMS = ['dried leaf', 'dried flower', 'root', 'bark', 'seed', 'resin', 'powder', 'fresh', 'tincture', 'oil', 'other'];
export const PLANT_PARTS = ['leaf', 'flower', 'root', 'bark', 'seed', 'berry', 'resin', 'whole herb'];
export const SOURCE_KINDS = ['bought', 'grown', 'foraged', 'made', 'gifted'];
export const SECTION_KINDS = ['herb', 'supply'];

export const sectionSchema = { name: 'string!', kind: { type: SECTION_KINDS, nullable: false }, sort_order: { type: 'int', nullable: false } };
export const supplierSchema = {
  name: 'string!', website: 'string', contact: 'string', good_for: 'string',
  rating: { type: 'int', min: 1, max: 5 }, notes: 'string',
};
export const itemSchema = {
  section_id: 'int!', name: 'string!', latin_name: 'string', form: FORMS, plant_part: PLANT_PARTS, size_label: 'string',
  amount: { type: 'number', min: 0, nullable: false }, unit: { type: UNITS, nullable: false },
  low_threshold: { type: 'number', min: 0 }, acquired_on: 'date', expires_on: 'date', storage_spot: 'string',
  source_kind: SOURCE_KINDS, source_place: 'string', source_from: 'string', notes: 'string',
  used_up: { type: 'bool', nullable: false },
};
export const purchaseSchema = {
  supplier_id: 'int', purchased_on: 'date!', quantity: { type: 'number', min: 0, required: true },
  price: { type: 'number', min: 0 }, order_note: 'string',
};
export const restockSchema = { ...purchaseSchema, expires_on: 'date' };
export const photoSchema = { caption: 'string', sort_order: { type: 'int', nullable: false }, is_cover: { type: 'bool', nullable: false } };
