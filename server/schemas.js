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

export const AHPA_CLASSES = ['1', '2a', '2b', '2c', '2d', '3', '4'];
export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const ELEMENTS = ['Fire', 'Water', 'Air', 'Earth'];
export const GENDERS = ['masculine', 'feminine'];
export const SOURCE_COVERS = ['uses', 'safety', 'tradition', 'garden'];
export const RECIPE_TYPES = ['tincture', 'glycerite', 'tea blend', 'infusion', 'decoction', 'infused oil', 'salve', 'balm', 'serum',
  'face oil', 'lotion', 'syrup', 'oxymel', 'vinegar', 'bath salts', 'bath blend', 'ritual oil', 'loose incense',
  'smoke-free herb bundle', 'sachet', 'moon water'];

// List fields (other_names, parts_used, zodiac, ...) are arrays of strings, checked by the grimoire service.
export const herbSchema = {
  common_name: 'string!', latin_name: 'string', family: 'string', uses: 'string', taste: 'string', energetics: 'string',
  caution_pregnancy: 'string', caution_medications: 'string', caution_conditions: 'string', caution_duration: 'string',
  caution_topical: 'string', ahpa_class: AHPA_CLASSES, planet: PLANETS, element: ELEMENTS, gender: GENDERS,
  garden_harvest_part: 'string', garden_harvest_timing: 'string', garden_sun: 'string', garden_water: 'string', notes: 'string',
};
export const herbSourceSchema = {
  title: 'string!', author: 'string', year: { type: 'int', min: 0, max: 3000 }, url: 'string',
  sort_order: { type: 'int', nullable: false },
};
