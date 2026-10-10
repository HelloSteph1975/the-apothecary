// server/services/today.js
import { listItems } from './cabinet.js';
import { dueSteps } from './batches.js';

const CAP = 8;
const pick = ({ id, name, size_label, amount, unit, low_threshold, expires_on, section_name, cover }) =>
  ({ id, name, size_label, amount, unit, low_threshold, expires_on, section_name, cover });
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const ratio = i => (i.low_threshold > 0 ? i.amount / i.low_threshold : 0);

export function todaySummary(db, today) {
  const low = listItems(db, { status: 'low' }, today).sort((a, b) => ratio(a) - ratio(b) || byName(a, b));
  const soon = listItems(db, { status: 'expiring' }, today).sort((a, b) => a.expires_on.localeCompare(b.expires_on) || byName(a, b));
  const gone = listItems(db, { status: 'expired' }, today).sort((a, b) => a.expires_on.localeCompare(b.expires_on) || byName(a, b));
  const due = dueSteps(db, today);
  return {
    runningLow: low.slice(0, CAP).map(pick),
    nearingExpiry: soon.slice(0, CAP).map(pick),
    expired: gone.slice(0, CAP).map(pick),
    batchesDue: due.slice(0, CAP),
    counts: { runningLow: low.length, nearingExpiry: soon.length, expired: gone.length, batchesDue: due.length },
  };
}
