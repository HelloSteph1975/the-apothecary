import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { HttpError, notFound } from '../http.js';
import { validate } from '../validate.js';
import { recipeSchema, recipeIngredientSchema } from '../schemas.js';
import { factorFor, roundAmount, scaleAmount } from '../lib/scale.js';
import { CAUTIONS } from './grimoire.js';

const MAX_INGREDIENTS = 60;
const GONE = 'That recipe is not in the book.';
const str = v => (typeof v === 'string' && v !== '' ? v : null);
const likeEscape = s => s.replace(/[\\%_]/g, '\\$&');

// Reading ------------------------------------------------------------------

const COVER_SQL = `(SELECT filename FROM photos p WHERE p.owner_type = 'recipe' AND p.owner_id = r.id AND p.deleted_at IS NULL
  ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1)`;

export function listRecipes(db, f = {}) {
  const where = [];
  const args = [];
  const q = str(f.q);
  if (q) {
    where.push(`(r.name LIKE ? ESCAPE '\\' OR r.intention LIKE ? ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM recipe_ingredients qi WHERE qi.recipe_id = r.id AND qi.deleted_at IS NULL AND qi.name LIKE ? ESCAPE '\\'))`);
    args.push(...Array(3).fill(`%${likeEscape(q)}%`));
  }
  if (str(f.type_id)) { where.push('r.type_id = ?'); args.push(Number(f.type_id)); }
  if (str(f.herb_id)) {
    where.push('EXISTS (SELECT 1 FROM recipe_ingredients hi WHERE hi.recipe_id = r.id AND hi.deleted_at IS NULL AND hi.herb_id = ?)');
    args.push(Number(f.herb_id));
  }
  if (f.topical === '1') where.push('t.is_topical = 1');
  if (f.topical === '0') where.push('t.is_topical = 0');
  const rows = db.prepare(`SELECT r.id, r.name, r.type_id, t.name AS type_name, t.icon AS type_icon, t.is_topical,
      r.yield_amount, r.yield_unit, ${COVER_SQL} AS cover,
      (SELECT COUNT(*) FROM recipe_ingredients ci WHERE ci.recipe_id = r.id AND ci.deleted_at IS NULL) AS ingredient_count
    FROM recipes r JOIN recipe_types t ON t.id = r.type_id
    WHERE r.deleted_at IS NULL${where.map(w => ` AND ${w}`).join('')}
    ORDER BY r.name COLLATE NOCASE, r.id`).all(...args);
  const herbs = new Map();
  for (const l of db.prepare(`SELECT DISTINCT ri.recipe_id, h.common_name FROM recipe_ingredients ri
    JOIN herbs h ON h.id = ri.herb_id AND h.deleted_at IS NULL
    JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL
    WHERE ri.deleted_at IS NULL ORDER BY h.common_name COLLATE NOCASE`).all()) {
    if (!herbs.has(l.recipe_id)) herbs.set(l.recipe_id, []);
    herbs.get(l.recipe_id).push(l.common_name);
  }
  return rows.map(row => ({ ...row, herb_names: herbs.get(row.id) ?? [] }));
}

function cautionsFor(db, ingredients) {
  const out = [];
  const seen = new Set();
  const getHerb = db.prepare('SELECT * FROM herbs WHERE id = ? AND deleted_at IS NULL');
  for (const ing of ingredients) {
    if (ing.herb_id == null || seen.has(ing.herb_id)) continue;
    seen.add(ing.herb_id);
    const herb = getHerb.get(ing.herb_id);
    if (!herb) continue;
    const items = CAUTIONS.map(c => `caution_${c}`)
      .filter(field => typeof herb[field] === 'string' && herb[field].trim() !== '')
      .map(field => ({ field, text: herb[field] }));
    if (items.length) out.push({ herb_id: herb.id, common_name: herb.common_name, items });
  }
  return out;
}

export function getRecipeDetail(db, id, query = {}) {
  const r = repos(db);
  const recipe = r.recipes.get(id);
  if (!recipe) throw notFound(GONE);
  const type = r.recipeTypes.get(recipe.type_id, { includeDeleted: true });
  const factor = factorFor(recipe, query);
  const ingredients = db.prepare(`SELECT ri.*, h.common_name AS live_herb_name FROM recipe_ingredients ri
    LEFT JOIN herbs h ON h.id = ri.herb_id AND h.deleted_at IS NULL
    WHERE ri.recipe_id = ? AND ri.deleted_at IS NULL ORDER BY ri.sort_order, ri.id`).all(id)
    .map(i => ({
      id: i.id, herb_id: i.herb_id, herb_name: i.live_herb_name ?? null, herb_deleted: i.herb_id != null && i.live_herb_name == null,
      name: i.name, amount: scaleAmount(i.amount, factor, i.unit), base_amount: i.amount, unit: i.unit, form: i.form,
      plant_part: i.plant_part, note: i.note,
    }));
  return {
    ...recipe,
    type,
    effective_wait_days: recipe.wait_days ?? type?.wait_days ?? null,
    effective_shelf_life_days: recipe.shelf_life_days ?? type?.shelf_life_days ?? null,
    factor,
    scaled_yield_amount: recipe.yield_amount == null ? null : roundAmount(recipe.yield_amount * factor, recipe.yield_unit),
    ingredients,
    cautions: cautionsFor(db, ingredients),
    label_caution: type?.label_caution ?? null,
    needs_patch_test: Boolean(type?.is_topical),
    photos: r.photos.list({ owner_type: 'recipe', owner_id: id }),
  };
}

// Writing ------------------------------------------------------------------

const isLive = (db, table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id));

function parseIngredients(db, list, errors) {
  if (!Array.isArray(list)) { errors.ingredients = 'Send a list of ingredients'; return undefined; }
  if (list.length > MAX_INGREDIENTS) { errors.ingredients = `Use at most ${MAX_INGREDIENTS} ingredients`; return undefined; }
  const herbName = db.prepare('SELECT common_name FROM herbs WHERE id = ? AND deleted_at IS NULL');
  return list.map((raw, i) => {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const res = validate(recipeIngredientSchema, src);
    const row = res.data ?? {};
    for (const [k, msg] of Object.entries(res.errors ?? {})) errors[`ingredients.${i}.${k}`] = msg;
    const named = typeof src.name === 'string' && src.name.trim() !== '';
    const herbGiven = src.herb_id != null && src.herb_id !== '';
    if (row.herb_id != null) {
      const herb = herbName.get(row.herb_id);
      if (!herb) errors[`ingredients.${i}.herb_id`] = "That herb isn't in the grimoire";
      else if (!named) row.name = herb.common_name;
    }
    if (!named && !herbGiven && !errors[`ingredients.${i}.name`]) errors[`ingredients.${i}.name`] = 'Add a name or pick a herb';
    return { ...row, sort_order: i };
  });
}

function parseRecipeInput(db, body, { partial, existing = null }) {
  const src = body && typeof body === 'object' ? body : {};
  const { data = {}, errors = {} } = validate(recipeSchema, src, { partial });
  if (data.type_id != null && !isLive(db, 'recipe_types', data.type_id)) errors.type_id = "That type doesn't exist";
  if (data.yield_amount === 0) errors.yield_amount = 'Must be more than 0';
  const merged = { ...existing, ...data };
  if (!errors.yield_amount && !errors.yield_unit && merged.yield_amount != null && merged.yield_unit == null) {
    errors.yield_unit = 'Pick a unit for the yield';
  }
  const ingredients = src.ingredients === undefined ? undefined : parseIngredients(db, src.ingredients, errors);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  return { data, ingredients };
}

function replaceIngredients(db, recipeId, ingredients, stamp) {
  const r = repos(db);
  db.prepare('UPDATE recipe_ingredients SET deleted_at = ? WHERE recipe_id = ? AND deleted_at IS NULL').run(stamp, recipeId);
  for (const ing of ingredients) r.recipeIngredients.create({ ...ing, recipe_id: recipeId });
}

// Both return the recipe's id.
export function createRecipe(db, body) {
  const { data, ingredients = [] } = parseRecipeInput(db, body, { partial: false });
  return transaction(db, () => {
    const recipe = repos(db).recipes.create(data);
    replaceIngredients(db, recipe.id, ingredients, new Date().toISOString());
    return recipe.id;
  });
}

export function updateRecipe(db, id, body) {
  const r = repos(db);
  const existing = r.recipes.get(id);
  if (!existing) throw notFound(GONE);
  const { data, ingredients } = parseRecipeInput(db, body, { partial: true, existing });
  transaction(db, () => {
    r.recipes.update(id, data);
    if (ingredients) replaceIngredients(db, id, ingredients, new Date().toISOString());
  });
  return id;
}

// Callers wrap these in a transaction together with the photo cascade.
export function deleteRecipe(db, id, stamp) {
  repos(db).recipes.remove(id, stamp);
  db.prepare('UPDATE recipe_ingredients SET deleted_at = ? WHERE recipe_id = ? AND deleted_at IS NULL').run(stamp, id);
}

export function restoreRecipe(db, id, stamp) {
  repos(db).recipes.restore(id);
  db.prepare('UPDATE recipe_ingredients SET deleted_at = NULL WHERE recipe_id = ? AND deleted_at = ?').run(id, stamp);
}
