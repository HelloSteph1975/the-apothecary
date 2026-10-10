import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { validate } from '../validate.js';
import { timingRuleSchema, PLANETS, ELEMENTS } from '../schemas.js';
import { addDays } from '../lib/dates.js';
import { typeKey } from '../lib/slugify.js';
import { reorderGroups } from './groups.js';
import { skyForDay, skyFacts, SIGNS, PHASE_NAMES, PHASE_GROUPS, FESTIVALS } from '../lib/sky.js';

// Bump when timing-rules.json gains entries that existing installs should receive.
// A future bump must seed only slugs that are new since the last version, so it never re-adds a starter rule she deleted.
export const TIMING_RULES_SEED_VERSION = 1;

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'timing-rules.json');
const SEED_KEY = 'timing_rules_seed_version';
const LIST_FIELDS = ['recipe_types', 'planets', 'elements'];
const MAX_TEXT = 300;
const MAX_LIST = 20;
const MAX_SLUG = 40;
const TOP_SUGGESTIONS = 2;
const TOP_DATES = 5;

// The values each kind of rule may name.
const VALUES = {
  phase_group: PHASE_GROUPS,
  phase: PHASE_NAMES,
  moon_element: ELEMENTS,
  moon_sign: SIGNS,
  day_ruler: PLANETS,
  festival: FESTIVALS.map(f => f.name),
};

export function loadStarterRules(file = DATA_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Adds each starter rule whose slug isn't there yet (live or deleted), so her edits and deletions stand.
export function seedTimingRules(db, entries = loadStarterRules()) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_KEY);
  if (row && Number(row.value) >= TIMING_RULES_SEED_VERSION) return { added: 0 };
  const rules = repos(db).timingRules;
  return transaction(db, () => {
    let added = 0;
    const exists = db.prepare('SELECT 1 FROM timing_rules WHERE slug = ?');
    entries.forEach((e, i) => {
      if (exists.get(e.slug)) return;
      rules.create({
        slug: e.slug, kind: e.kind, value: e.value, text: e.text, weight: e.weight ?? 1, sort_order: i, is_starter: 1,
        recipe_types: JSON.stringify(e.recipe_types ?? []), planets: JSON.stringify(e.planets ?? []), elements: JSON.stringify(e.elements ?? []),
      });
      added++;
    });
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(SEED_KEY, String(TIMING_RULES_SEED_VERSION));
    return { added };
  });
}

// Rows ----------------------------------------------------------------------

function parseList(text) {
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function parseRule(row) {
  if (!row) return row;
  return { ...row, recipe_types: parseList(row.recipe_types), planets: parseList(row.planets), elements: parseList(row.elements) };
}

export function listTimingRules(db) {
  return repos(db).timingRules.list().map(parseRule);
}

export function getTimingRule(db, id, opts) {
  return parseRule(repos(db).timingRules.get(id, opts));
}

// Writing -------------------------------------------------------------------

function checkList(name, v, allowed, errors) {
  if (!Array.isArray(v)) { errors[name] = 'Send a list'; return null; }
  if (v.length > MAX_LIST) { errors[name] = `Use at most ${MAX_LIST}`; return null; }
  const out = [];
  for (const x of v) {
    const s = typeof x === 'string' ? x.trim() : '';
    if (!s) { errors[name] = 'Use text only'; return null; }
    if (allowed ? !allowed.includes(s) : s.length > MAX_SLUG) {
      errors[name] = allowed ? `Choose from: ${allowed.join(', ')}` : `Each one must be ${MAX_SLUG} characters or fewer`;
      return null;
    }
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

// `existing` is the stored rule on an edit; kind and value are checked together, so changing only one still has to fit the other.
function parseRuleBody(body, { partial, existing }) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const { data = {}, errors = {} } = validate(timingRuleSchema, src, { partial });
  if (data.text && data.text.length > MAX_TEXT) errors.text = `Use ${MAX_TEXT} characters or fewer`;
  const kind = data.kind ?? existing?.kind;
  const value = data.value ?? existing?.value;
  if (!errors.kind && !errors.value && kind && value && !VALUES[kind].includes(value)) {
    errors.value = `That isn't a ${kind.replace('_', ' ')}. Choose from: ${VALUES[kind].join(', ')}`;
  }
  const lists = { recipe_types: null, planets: PLANETS, elements: ELEMENTS };
  for (const name of LIST_FIELDS) {
    if (!Object.hasOwn(src, name)) continue;
    const list = checkList(name, src[name], lists[name], errors);
    if (list) data[name] = JSON.stringify(list);
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  return data;
}

function nextRuleOrder(db) {
  return db.prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) n FROM timing_rules WHERE deleted_at IS NULL').get().n;
}

export function createTimingRule(db, body) {
  const data = parseRuleBody(body, { partial: false, existing: null });
  const row = repos(db).timingRules.create({ sort_order: nextRuleOrder(db), ...data, slug: null, is_starter: 0 });
  return parseRule(row);
}

export function updateTimingRule(db, id, body) {
  const r = repos(db).timingRules;
  const existing = r.get(id);
  if (!existing) throw notFound('That rule is gone.');
  return parseRule(r.update(id, parseRuleBody(body, { partial: true, existing })));
}

export function reorderTimingRules(db, ids) {
  reorderGroups(db, repos(db).timingRules, ids, 'Send the rule ids in their new order.');
  return listTimingRules(db);
}

export function deleteTimingRule(db, id, stamp = new Date().toISOString()) {
  if (!repos(db).timingRules.remove(id, stamp)) throw notFound('That rule is gone.');
}

export function restoreTimingRule(db, id) {
  const r = repos(db).timingRules;
  const row = r.get(id, { includeDeleted: true });
  if (!row || !row.deleted_at) throw notFound('Nothing to undo');
  r.restore(id);
  return getTimingRule(db, id);
}

// Matching ------------------------------------------------------------------

// What the day has for each kind of rule. The moon sign is the one at local noon.
const dayValue = {
  phase_group: sky => sky.phase.group,
  phase: sky => sky.phase.name,
  moon_element: sky => sky.moon.element,
  moon_sign: sky => sky.moon.sign,
  day_ruler: sky => sky.ruler,
  festival: sky => sky.festival,
};

const matches = (rule, sky) => dayValue[rule.kind](sky) === rule.value;

export function rulesForDay(db, sky) {
  return listTimingRules(db).filter(rule => matches(rule, sky));
}

const byWeight = (a, b) => b.weight - a.weight || a.sort_order - b.sort_order || a.id - b.id;

export function todaySuggestions(db, day, settings) {
  const sky = skyForDay(day, { hemisphere: settings.hemisphere });
  if (settings.sky_suggestions === 'off') return { sky, suggestions: [] };
  const suggestions = rulesForDay(db, sky).sort(byWeight).slice(0, TOP_SUGGESTIONS).map(({ id, text }) => ({ id, text }));
  return { sky, suggestions };
}

// The local calendar day, as the server's computer sees it.
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// What a recipe is made of, for matching: its type slug, and the planets and elements of its linked live herbs.
function recipeTraits(db, recipeId) {
  const recipe = repos(db).recipes.get(recipeId);
  if (!recipe) throw notFound('That recipe is not in the book.');
  const type = repos(db).recipeTypes.get(recipe.type_id, { includeDeleted: true });
  const herbs = db.prepare(`SELECT DISTINCT h.planet, h.element FROM recipe_ingredients i
    JOIN herbs h ON h.id = i.herb_id AND h.deleted_at IS NULL
    WHERE i.recipe_id = ? AND i.deleted_at IS NULL`).all(recipeId);
  return {
    slug: typeKey(type),
    planets: new Set(herbs.map(h => h.planet).filter(Boolean)),
    elements: new Set(herbs.map(h => h.element).filter(Boolean)),
  };
}

const favours = (rule, traits) => (traits.slug != null && rule.recipe_types.includes(traits.slug))
  || rule.planets.some(p => traits.planets.has(p))
  || rule.elements.some(e => traits.elements.has(e));

export function startDates(db, recipeId, { from, days = 28 } = {}, settings) {
  const traits = recipeTraits(db, recipeId);
  if (settings.sky_suggestions === 'off') return [];
  const rules = listTimingRules(db).filter(rule => favours(rule, traits)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  if (!rules.length) return [];
  const start = from ?? localToday();
  const scored = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const sky = skyFacts(day, { hemisphere: settings.hemisphere });
    const hits = rules.filter(rule => matches(rule, sky));
    const score = hits.reduce((n, rule) => n + rule.weight, 0);
    if (score > 0) {
      scored.push({ day, score, sky: { phase: sky.phase.name, sign: sky.moon.sign, ruler: sky.ruler }, reasons: hits.map(rule => rule.text) });
    }
  }
  return scored.sort((a, b) => b.score - a.score || a.day.localeCompare(b.day)).slice(0, TOP_DATES);
}
