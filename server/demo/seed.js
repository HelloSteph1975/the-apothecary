import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { saveSettings } from '../services/settings.js';
import { createItem } from '../services/cabinet.js';
import { addDays, addMonths } from '../lib/dates.js';
import { seedGrimoire, linkItemsToHerbs } from '../services/grimoire.js';
import { trashPhotoFile } from '../services/photos.js';
import { seedRecipeTypes } from '../services/recipeTypes.js';
import { createRecipe } from '../services/recipes.js';
import { createBatch, finishBatch } from '../services/batches.js';
import { convert } from '../lib/units.js';
import { createTask } from '../services/tasks.js';
import { nextDue } from '../lib/repeat.js';

// Bump when the demo stock changes, so older demo folders get the new stock once.
const SEED_VERSION = '6';
const DEMO_SETTINGS = { keeper_name: 'Demo Keeper', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };

// The local calendar date, the same way the client works out "today".
function localToday(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Clears the demo batches, children first, so recipes and jars can go after them. Trashes their photo files.
function clearBatches(db, dataDir) {
  for (const { filename } of db.prepare("SELECT filename FROM photos WHERE owner_type = 'batch'").all()) {
    trashPhotoFile(dataDir, filename);
  }
  db.exec("DELETE FROM batch_steps; DELETE FROM batch_ingredients; DELETE FROM batches; DELETE FROM photos WHERE owner_type = 'batch'");
}

// Clears the demo tasks and the dismissals, and trashes their photo files. Runs before the batches and jars they point at.
function clearTasks(db, dataDir) {
  for (const { filename } of db.prepare("SELECT filename FROM photos WHERE owner_type = 'task'").all()) {
    trashPhotoFile(dataDir, filename);
  }
  db.exec("DELETE FROM task_dismissals; DELETE FROM tasks; DELETE FROM photos WHERE owner_type = 'task'");
}

// Adds three of her kind of tasks. The app makes the automatic ones from the demo jars and steps.
function stockTasks(db, today) {
  const batch = db.prepare("SELECT id FROM batches WHERE name = 'Calendula skin salve' AND deleted_at IS NULL").get()?.id;
  const rosemary = { repeat_kind: 'weekly', repeat_days: [1, 4] };
  createTask(db, { title: 'Water the rosemary', notes: 'A good soak, then let it dry out.', ...rosemary, due_on: nextDue(rosemary, addDays(today, -1)), today });
  createTask(db, { title: 'Make moon water', notes: 'Set a jar of water out under the moon overnight.', repeat_kind: 'full_moon', due_on: nextDue({ repeat_kind: 'full_moon' }, addDays(today, -1)), today });
  createTask(db, {
    title: 'Label the new tinctures', due_on: addDays(today, 2), priority: 'high', today,
    ...(batch ? { related_type: 'batch', related_id: batch } : {}),
  });
}

// Clears what the demo stocks (not the sections) so a reset doesn't double up.
function clearCabinet(db, dataDir) {
  // Photo files go to the trash first (purgeTrash removes them later), so none are left in the live folder.
  for (const { filename } of db.prepare("SELECT filename FROM photos WHERE owner_type IN ('item', 'supplier')").all()) {
    trashPhotoFile(dataDir, filename);
  }
  db.exec(`DELETE FROM purchases; DELETE FROM items; DELETE FROM suppliers;
    DELETE FROM photos WHERE owner_type IN ('item', 'supplier')`);
}

// Clears the demo recipes (not the recipe types) and trashes their photo files.
function clearRecipes(db, dataDir) {
  for (const { filename } of db.prepare("SELECT filename FROM photos WHERE owner_type = 'recipe'").all()) {
    trashPhotoFile(dataDir, filename);
  }
  db.exec("DELETE FROM recipe_ingredients; DELETE FROM recipes; DELETE FROM photos WHERE owner_type = 'recipe'");
}

// Adds the three demo recipes, linked to grimoire herbs by slug. Needs the grimoire and the starter types.
function stockRecipes(db) {
  seedGrimoire(db);
  seedRecipeTypes(db);
  const typeId = slug => db.prepare('SELECT id FROM recipe_types WHERE slug = ? AND deleted_at IS NULL').get(slug)?.id;
  const herbId = slug => db.prepare('SELECT id FROM herbs WHERE slug = ? AND deleted_at IS NULL').get(slug)?.id ?? null;
  const herb = (slug, name, amount, unit, extra = {}) => ({ herb_id: herbId(slug), name, amount, unit, ...extra });
  const add = (slug, recipe) => {
    const type_id = typeId(slug);
    if (type_id) createRecipe(db, { type_id, ...recipe });
  };
  add('salve', {
    name: 'Calendula skin salve', yield_amount: 120, yield_unit: 'ml', intention: 'A gentle salve for dry, chapped skin.',
    steps: '1. Warm the calendula-infused oil in a double boiler until just warm.\n2. Stir in the beeswax until it melts.\n3. Pour into tins and let it set without moving it.\n4. Label and date each tin.',
    ingredients: [
      herb('calendula', 'Calendula-infused olive oil', 100, 'ml', { form: 'oil', plant_part: 'flower' }),
      { name: 'Beeswax pastilles', amount: 15, unit: 'g' },
    ],
  });
  add('tea-blend', {
    name: 'Sleepy chamomile tea', yield_amount: 6, yield_unit: 'parts', intention: 'A soft evening cup.',
    steps: '1. Mix the dried herbs in a jar.\n2. Steep one teaspoon in hot water for five minutes, covered.\n3. Strain and sip slowly.',
    ingredients: [
      herb('chamomile', 'Chamomile', 3, 'parts', { form: 'dried flower', plant_part: 'flower' }),
      herb('lavender', 'Lavender', 1, 'parts', { form: 'dried flower', plant_part: 'flower' }),
      herb('lemon-balm', 'Lemon balm', 2, 'parts', { form: 'dried leaf', plant_part: 'leaf' }),
    ],
  });
  add('serum', {
    name: 'Rose face serum', yield_amount: 30, yield_unit: 'ml', intention: 'A light rose-scented serum for evenings.',
    steps: '1. Fill a small jar loosely with dried rose petals.\n2. Cover with jojoba oil and seal.\n3. Leave in a warm spot for two weeks, shaking now and then.\n4. Strain into a dropper bottle.',
    ingredients: [
      herb('rose', 'Rose petals', 5, 'g', { form: 'dried flower', plant_part: 'flower' }),
      { name: 'Jojoba oil', amount: 30, unit: 'ml' },
    ],
  });
}

// Adds two sample batches: one still steeping and one finished with its made jar.
// Draws go through the batch service so the jars end up with the right amounts.
function stockBatches(db, today) {
  const jar = name => db.prepare('SELECT id FROM items WHERE name = ? AND deleted_at IS NULL AND used_up_at IS NULL ORDER BY id').get(name)?.id ?? null;
  const jarUnit = id => db.prepare('SELECT unit FROM items WHERE id = ?').get(id)?.unit;
  const herb = slug => db.prepare('SELECT id FROM herbs WHERE slug = ? AND deleted_at IS NULL').get(slug)?.id ?? null;
  // Draws from a jar only when it is there (an older folder may not have the demo jars).
  const draw = (slug, name, amount) => {
    const item_id = jar(name);
    // The amounts here are grams; the jar may hold another unit. Draw only when grams convert to it.
    const drawn = item_id ? convert(amount, 'g', jarUnit(item_id)) : null;
    return { herb_id: herb(slug), name, amount, unit: 'g', ...(drawn != null ? { item_id, drawn_amount: drawn } : {}) };
  };
  const recipe = name => db.prepare('SELECT id FROM recipes WHERE name = ? AND deleted_at IS NULL').get(name)?.id ?? null;

  createBatch(db, {
    name: 'Calendula skin salve', recipe_id: recipe('Calendula skin salve'), start_date: addDays(today, -10), confirm_short: true,
    intention: 'A gentle salve for dry, chapped skin.', base: 'Olive oil and beeswax',
    method: 'Infused the calendula in warm olive oil, then left it to steep on the shelf.',
    lines: [
      draw('calendula', 'Calendula', 10),
      { name: 'Olive oil', amount: 100, unit: 'ml' },
    ],
    steps: [{ title: 'Strain and bottle', due_on: addDays(today, 4) }],
  });

  const tea = createBatch(db, {
    name: 'Sleepy chamomile tea', recipe_id: recipe('Sleepy chamomile tea'), start_date: addDays(today, -12), confirm_short: true,
    intention: 'A soft evening cup.', method: 'Mixed the dried herbs in a jar and shook it well.',
    noticed: 'Sweet and calming. Lavender was just right.', would_change: 'A little more lemon balm next time.',
    lines: [
      draw('chamomile', 'Chamomile', 18),
      draw('lavender', 'Lavender', 6),
      { name: 'Lemon balm', amount: 12, unit: 'g' },
    ],
    steps: [{ title: 'Taste and adjust', due_on: addDays(today, -8) }],
  });
  // The made jar joins the cabinet only when the demo jars are there; an older folder with her own stock gets none.
  const madeJar = jar('Chamomile')
    ? { add_to_cabinet: { section_id: ensureSection(db, 'Herbs'), name: 'Sleepy chamomile tea', amount: 36, unit: 'g', storage_spot: 'Middle shelf' } } : {};
  finishBatch(db, tea, { finished_on: addDays(today, -7), yield_amount: 36, yield_unit: 'g', ...madeJar });
}

// Finds the live section with this name. If she renamed or deleted it, brings back a deleted one
// or adds a new one at the end. Never renames her sections.
function ensureSection(db, name) {
  const live = db.prepare('SELECT id FROM cabinet_sections WHERE name = ? AND deleted_at IS NULL ORDER BY id').get(name);
  if (live) return live.id;
  const gone = db.prepare('SELECT id FROM cabinet_sections WHERE name = ? AND deleted_at IS NOT NULL ORDER BY id DESC').get(name);
  if (gone) {
    db.prepare('UPDATE cabinet_sections SET deleted_at = NULL WHERE id = ?').run(gone.id);
    return gone.id;
  }
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM cabinet_sections').get().n;
  return repos(db).sections.create({ name, kind: name === 'Herbs' ? 'herb' : 'supply', sort_order: next }).id;
}

function stockCabinet(db, today) {
  const r = repos(db);
  const section = name => ensureSection(db, name);
  const moonvale = r.suppliers.create({ name: 'Moonvale Botanicals', rating: 5, good_for: 'Dried herbs and resins' });
  const tinGlass = r.suppliers.create({ name: 'Tin & Glass Co', rating: 4, good_for: 'Bottles, tins and droppers' });
  const bought = (supplier, ageDays, price) => ({ supplier_id: supplier.id, purchased_on: addDays(today, -ageDays), price });
  const add = (sectionName, data, purchase) => createItem(db, {
    section_id: section(sectionName), ...data,
    ...(purchase ? { source_kind: 'bought', acquired_on: purchase.purchased_on, purchase } : {}),
  });

  add('Herbs', { name: 'Calendula', latin_name: 'Calendula officinalis', form: 'dried flower', plant_part: 'flower', amount: 30, unit: 'g', low_threshold: 50, storage_spot: 'Top shelf', expires_on: addMonths(today, 8) }, bought(moonvale, 60, 9.5));
  add('Herbs', { name: 'Chamomile', latin_name: 'Matricaria chamomilla', form: 'dried flower', plant_part: 'flower', amount: 120, unit: 'g', low_threshold: 40, storage_spot: 'Top shelf', expires_on: addDays(today, 21) }, bought(moonvale, 300, 11));
  add('Herbs', { name: 'Lavender', latin_name: 'Lavandula angustifolia', form: 'dried flower', plant_part: 'flower', amount: 90, unit: 'g', storage_spot: 'Top shelf', source_kind: 'grown', acquired_on: addDays(today, -90), expires_on: addMonths(today, 9) });
  add('Herbs', { name: 'Mugwort', latin_name: 'Artemisia vulgaris', form: 'dried leaf', plant_part: 'leaf', amount: 45, unit: 'g', storage_spot: 'Middle shelf', source_kind: 'foraged', source_place: 'the meadow by the old mill', acquired_on: addDays(today, -400), expires_on: addDays(today, -15) });
  add('Herbs', { name: 'Rose petals', latin_name: 'Rosa gallica', form: 'dried flower', plant_part: 'flower', amount: 60, unit: 'g', storage_spot: 'Middle shelf', source_kind: 'gifted', source_from: 'Rowan', acquired_on: addDays(today, -330), expires_on: addDays(today, 12) });
  add('Oils and butters', { name: 'Jojoba oil', amount: 250, unit: 'ml', low_threshold: 60, storage_spot: 'Workbench' }, bought(moonvale, 45, 14));
  add('Waxes', { name: 'Beeswax pastilles', amount: 80, unit: 'g', low_threshold: 100, storage_spot: 'Workbench' }, bought(moonvale, 120, 12.5));
  add('Essential oils', { name: 'Lavender essential oil', amount: 15, unit: 'ml', low_threshold: 5, storage_spot: 'Workbench' }, bought(moonvale, 30, 8));
  add('Containers', { name: 'Amber dropper bottles', size_label: '30 ml', amount: 24, unit: 'count', low_threshold: 6, storage_spot: 'Bottom shelf' }, bought(tinGlass, 50, 18));
  add('Containers', { name: 'Tins', size_label: '2 oz', amount: 12, unit: 'count', low_threshold: 4, storage_spot: 'Bottom shelf' }, bought(tinGlass, 50, 15));
  add('Labels and packaging', { name: 'Kraft jar labels', amount: 60, unit: 'count', low_threshold: 20, storage_spot: 'Bottom shelf' }, bought(tinGlass, 20, 6));
  add('Tools and equipment', { name: 'Digital scale', amount: 1, unit: 'count', storage_spot: 'Workbench' }, bought(tinGlass, 200, 16));
  linkDemoHerbs(db);
}

// The server's once-per-version link step may have run already (a reset, or an older demo folder),
// so link the freshly stocked herbs here. The grimoire must exist first on a brand new demo folder.
function linkDemoHerbs(db) {
  seedGrimoire(db);
  linkItemsToHerbs(db);
}

// Seeds the demo folder once (or again with reset). Later stages add more samples here.
export function seedDemo(ctx, { reset = false } = {}) {
  const db = ctx.db;
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get();
  if (seeded && !reset) {
    const stocked = db.prepare('SELECT 1 FROM items WHERE deleted_at IS NULL').get();
    if (seeded.value === SEED_VERSION) return false;
    transaction(db, () => {
      if (stocked) linkDemoHerbs(db);
      else stockCabinet(db, localToday());
      if (!db.prepare('SELECT 1 FROM recipes').get()) stockRecipes(db);
      if (!db.prepare('SELECT 1 FROM batches').get()) stockBatches(db, localToday());
      if (!db.prepare('SELECT 1 FROM tasks').get()) stockTasks(db, localToday());
      db.prepare("UPDATE settings SET value = ? WHERE key = 'demo_seeded'").run(SEED_VERSION);
    });
    return !stocked;
  }
  transaction(db, () => {
    saveSettings(db, DEMO_SETTINGS);
    clearTasks(db, ctx.config.dataDir);
    clearBatches(db, ctx.config.dataDir);
    clearCabinet(db, ctx.config.dataDir);
    stockCabinet(db, localToday());
    clearRecipes(db, ctx.config.dataDir);
    stockRecipes(db);
    stockBatches(db, localToday());
    stockTasks(db, localToday());
    db.prepare("INSERT INTO settings (key, value) VALUES ('demo_seeded', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(SEED_VERSION);
  });
  return true;
}
