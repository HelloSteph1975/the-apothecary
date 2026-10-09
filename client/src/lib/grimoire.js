// Mirrors server/schemas.js; the client can't import server code.
const opt = (value, label = value.charAt(0).toUpperCase() + value.slice(1)) => ({ value, label });

export const HERB_PARTS = ['leaf', 'flower', 'root', 'bark', 'seed', 'berry', 'resin', 'whole herb', 'bulb'].map(v => opt(v));
export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map(v => opt(v));
export const ELEMENTS = ['Fire', 'Water', 'Air', 'Earth'].map(v => opt(v));
export const SOURCE_COVERS = ['uses', 'safety', 'tradition', 'garden'].map(v => opt(v));
export const RECIPE_TYPES = ['tincture', 'glycerite', 'tea blend', 'infusion', 'decoction', 'infused oil', 'salve', 'balm', 'serum',
  'face oil', 'lotion', 'syrup', 'oxymel', 'vinegar', 'bath salts', 'bath blend', 'ritual oil', 'loose incense',
  'smoke-free herb bundle', 'sachet', 'moon water'].map(v => opt(v));

export const AHPA_CLASSES = ['1', '2a', '2b', '2c', '2d', '3', '4'];
export const AHPA_LABELS = {
  '1': 'Class 1: generally safe with sensible use',
  '2a': 'Class 2a: for use on the skin only',
  '2b': 'Class 2b: avoid during pregnancy',
  '2c': 'Class 2c: avoid while nursing',
  '2d': 'Class 2d: has other specific limits on use',
  '3': 'Class 3: only with expert guidance',
  '4': 'Class 4: too little information to classify',
};

export const CAUTION_FIELDS = [
  ['caution_pregnancy', 'Pregnancy and nursing'],
  ['caution_medications', 'Medicines'],
  ['caution_conditions', 'Health conditions'],
  ['caution_duration', 'How long to use'],
  ['caution_topical', 'On the skin'],
];
