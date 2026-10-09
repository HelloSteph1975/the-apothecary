const opt = (value, label = value.charAt(0).toUpperCase() + value.slice(1)) => ({ value, label });

export const UNITS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'L' },
  { value: 'fl oz', label: 'fl oz' },
  { value: 'count', label: 'Count' },
];
export const FORMS = ['dried leaf', 'dried flower', 'root', 'bark', 'seed', 'resin', 'powder', 'fresh', 'tincture', 'oil', 'other'].map(v => opt(v));
export const PLANT_PARTS = ['leaf', 'flower', 'root', 'bark', 'seed', 'berry', 'resin', 'whole herb'].map(v => opt(v));
export const SOURCE_KINDS = [opt('bought'), opt('grown'), opt('foraged'), opt('made'), opt('gifted', 'Gifted or traded')];

const unitLabel = unit => (unit === 'l' ? 'L' : unit);
const num = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function formatAmount(amount, unit) {
  if (amount == null) return '';
  return unit === 'count' ? num(amount) : `${num(amount)} ${unitLabel(unit)}`;
}

export const formatMoney = n => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n));

export function statusBadges(status = {}) {
  const out = [];
  if (status.low) out.push({ key: 'low', label: 'Running low', tone: 'oxblood' });
  if (status.expiring) out.push({ key: 'expiring', label: 'Use soon', tone: 'brass' });
  if (status.expired) out.push({ key: 'expired', label: 'Past its best', tone: 'oxblood' });
  return out;
}

export function sourceText(item) {
  switch (item.source_kind) {
    case 'bought': return item.last_supplier_name ? `Bought from ${item.last_supplier_name}` : 'Bought';
    case 'grown': return 'Grown';
    case 'foraged': return item.source_place ? `Foraged at ${item.source_place}` : 'Foraged';
    case 'made': return 'Made';
    case 'gifted': return item.source_from ? `Gifted by ${item.source_from}` : 'Gifted';
    default: return '';
  }
}

// 'YYYY-MM-DD' to 'Oct 1, 2026', read as a local date so it never slips a day.
export function formatDay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Only plain web addresses become links; anything else (like javascript:) is dropped.
export function safeUrl(v) {
  const t = typeof v === 'string' ? v.trim() : '';
  return /^https?:\/\//i.test(t) ? t : null;
}

// 'YYYY-MM-DD' to 'Oct 20', for dates that are always close by.
export function formatShortDay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
