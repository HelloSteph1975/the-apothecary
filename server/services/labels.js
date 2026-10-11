import { HttpError } from '../http.js';
import { isDate } from '../lib/dates.js';
import { skyFacts } from '../lib/sky.js';

export const MAX_LABEL_IDS = 60;
const CAUTION_FIELDS = ['caution_pregnancy', 'caution_medications', 'caution_conditions', 'caution_duration', 'caution_topical'];
const filled = v => typeof v === 'string' && v.trim() !== '';

export function phaseFor(day) {
  return isDate(day) ? skyFacts(day).phase.name : null;
}

// "Check cautions for ..." only names herbs; it never says anything is safe.
function cautionLine(typeCaution, herbs) {
  const flagged = herbs.filter(h => CAUTION_FIELDS.some(f => filled(h[f])));
  const parts = [];
  if (filled(typeCaution)) parts.push(typeCaution.trim());
  if (flagged.length) parts.push(`Check cautions for ${flagged.map(h => h.common_name).join(', ')} before use.`);
  return parts.length ? parts.join(' ') : null;
}

const liveHerb = (db, id) => (id == null ? null : db.prepare('SELECT * FROM herbs WHERE id = ? AND deleted_at IS NULL').get(id) ?? null);

function batchParts(db, batch) {
  const lines = db.prepare('SELECT name, herb_id FROM batch_ingredients WHERE batch_id = ? AND deleted_at IS NULL ORDER BY sort_order, id').all(batch.id);
  const seen = new Set();
  const herbs = [];
  for (const l of lines) {
    if (l.herb_id == null || seen.has(l.herb_id)) continue;
    seen.add(l.herb_id);
    const herb = liveHerb(db, l.herb_id);
    if (herb) herbs.push(herb);
  }
  const type = batch.type_id == null ? null : db.prepare('SELECT label_caution FROM recipe_types WHERE id = ? AND deleted_at IS NULL').get(batch.type_id);
  return {
    ingredients: lines.length ? lines.map(l => l.name).join(', ') : null,
    caution: cautionLine(type?.label_caution, herbs),
  };
}

function shape(source, fields) {
  return {
    source, name: fields.name, latin_name: fields.latin_name ?? null, made_on: fields.made_on ?? null,
    phase: phaseFor(fields.made_on), expires_on: fields.expires_on ?? null,
    ingredients: fields.ingredients ?? null, caution: fields.caution ?? null,
  };
}

function jarLabel(db, id) {
  const jar = db.prepare('SELECT * FROM items WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!jar) return null;
  const batch = db.prepare(`SELECT * FROM batches WHERE item_id = ? AND finished_on IS NOT NULL AND deleted_at IS NULL
    ORDER BY finished_on DESC, id DESC LIMIT 1`).get(id);
  const parts = batch ? batchParts(db, batch) : { ingredients: null, caution: cautionLine(null, [liveHerb(db, jar.herb_id)].filter(Boolean)) };
  return shape({ kind: 'item', id }, {
    name: jar.name, latin_name: jar.latin_name, made_on: jar.acquired_on, expires_on: jar.expires_on, ...parts,
  });
}

function batchLabel(db, id) {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!batch) return null;
  return shape({ kind: 'batch', id }, { name: batch.name, made_on: batch.start_date, expires_on: batch.expires_on, ...batchParts(db, batch) });
}

// "1,2,3" into [1, 2, 3]. Anything else is a 400.
export function parseIds(raw, field) {
  if (raw === undefined || raw === '') return [];
  const bad = () => new HttpError(400, 'Please fix the highlighted fields.', { [field]: 'Must be a list of ids' });
  if (typeof raw !== 'string') throw bad();
  return raw.split(',').map(part => {
    if (!/^\d+$/.test(part.trim()) || Number(part) < 1) throw bad();
    return Number(part);
  });
}

export function getLabelData(db, { items = [], batches = [] }) {
  if (items.length + batches.length > MAX_LABEL_IDS) throw new HttpError(400, `Pick at most ${MAX_LABEL_IDS} labels at a time.`);
  return [...items.map(id => jarLabel(db, id)), ...batches.map(id => batchLabel(db, id))].filter(Boolean);
}
