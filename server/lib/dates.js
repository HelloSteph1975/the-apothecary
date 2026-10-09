// Calendar arithmetic on YYYY-MM-DD strings, done in UTC so time zones never shift the day.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const fmt = dt => dt.toISOString().slice(0, 10);

export function isDate(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const { y, m, d } = parse(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(s, n) {
  const { y, m, d } = parse(s);
  return fmt(new Date(Date.UTC(y, m - 1, d + n)));
}

export function addMonths(s, n) {
  const { y, m, d } = parse(s);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))));
}
