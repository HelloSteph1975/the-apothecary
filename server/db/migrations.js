const TS = `created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT`;

// Each entry runs once, in order. Never edit an entry after it ships; add a new one.
export const migrations = [
  // 1: settings and photos. Photos can belong to any kind of record, so owner_type is free text;
  // the photos route checks it against the kinds that exist.
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE photos (id INTEGER PRIMARY KEY, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL,
    filename TEXT NOT NULL, caption TEXT, is_cover INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_photos_owner ON photos(owner_type, owner_id);
  `,
  // 2: the herb cabinet. One item row per physical container; purchases log each buy.
  `
  CREATE TABLE cabinet_sections (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'supply' CHECK (kind IN ('herb','supply')), sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, website TEXT, contact TEXT, good_for TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5), notes TEXT, ${TS});
  CREATE TABLE items (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES cabinet_sections(id),
    name TEXT NOT NULL, latin_name TEXT, herb_id INTEGER,
    form TEXT CHECK (form IN ('dried leaf','dried flower','root','bark','seed','resin','powder','fresh','tincture','oil','other')),
    plant_part TEXT CHECK (plant_part IN ('leaf','flower','root','bark','seed','berry','resin','whole herb')),
    size_label TEXT, amount REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g' CHECK (unit IN ('g','kg','oz','lb','ml','l','fl oz','count')),
    low_threshold REAL, acquired_on TEXT, expires_on TEXT, storage_spot TEXT,
    source_kind TEXT CHECK (source_kind IN ('bought','grown','foraged','made','gifted')),
    source_place TEXT, source_from TEXT, notes TEXT, used_up_at TEXT, ${TS});
  CREATE TABLE purchases (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id),
    supplier_id INTEGER REFERENCES suppliers(id), purchased_on TEXT NOT NULL, quantity REAL NOT NULL,
    unit TEXT NOT NULL, price REAL, order_note TEXT, ${TS});
  CREATE INDEX idx_items_section ON items(section_id);
  CREATE INDEX idx_purchases_item ON purchases(item_id);
  CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
  INSERT INTO cabinet_sections (name, kind, sort_order) VALUES
    ('Herbs','herb',0), ('Oils and butters','supply',1), ('Waxes','supply',2), ('Alcohol and vinegars','supply',3),
    ('Honey and sweeteners','supply',4), ('Essential oils','supply',5), ('Salts and minerals','supply',6),
    ('Resins and incense','supply',7), ('Candles','supply',8), ('Crystals and stones','supply',9),
    ('Containers','supply',10), ('Labels and packaging','supply',11), ('Cloth and bags','supply',12),
    ('Tools and equipment','supply',13), ('Other','supply',14);
  `,
  // 3: the grimoire. Herb reference entries with their sources; items.herb_id (from migration 2) links jars to them.
  `
  CREATE TABLE herbs (id INTEGER PRIMARY KEY, slug TEXT, common_name TEXT NOT NULL, other_names TEXT NOT NULL DEFAULT '[]',
    latin_name TEXT, family TEXT, parts_used TEXT NOT NULL DEFAULT '[]', uses TEXT, preparations TEXT NOT NULL DEFAULT '[]',
    taste TEXT, energetics TEXT, caution_pregnancy TEXT, caution_medications TEXT, caution_conditions TEXT,
    caution_duration TEXT, caution_topical TEXT,
    ahpa_class TEXT CHECK (ahpa_class IN ('1','2a','2b','2c','2d','3','4')),
    planet TEXT CHECK (planet IN ('Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn')),
    element TEXT CHECK (element IN ('Fire','Water','Air','Earth')),
    zodiac TEXT NOT NULL DEFAULT '[]', gender TEXT CHECK (gender IN ('masculine','feminine')),
    associations TEXT NOT NULL DEFAULT '[]', garden_harvest_part TEXT, garden_harvest_timing TEXT, garden_sun TEXT,
    garden_water TEXT, garden_companions TEXT NOT NULL DEFAULT '[]', notes TEXT, is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE UNIQUE INDEX idx_herbs_slug ON herbs(slug) WHERE slug IS NOT NULL;
  CREATE TABLE herb_sources (id INTEGER PRIMARY KEY, herb_id INTEGER NOT NULL REFERENCES herbs(id), title TEXT NOT NULL,
    author TEXT, year INTEGER, url TEXT, covers TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_herb_sources_herb ON herb_sources(herb_id);
  CREATE INDEX idx_items_herb ON items(herb_id);
  `,
  // 4: the recipe book. Starter types are seeded at startup; units are checked by the service against RECIPE_UNITS.
  `
  CREATE TABLE recipe_types (id INTEGER PRIMARY KEY, slug TEXT, name TEXT NOT NULL, description TEXT,
    wait_days INTEGER CHECK (wait_days IS NULL OR wait_days >= 0),
    shelf_life_days INTEGER CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
    label_caution TEXT, is_topical INTEGER NOT NULL DEFAULT 0, icon TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE UNIQUE INDEX idx_recipe_types_slug ON recipe_types(slug) WHERE slug IS NOT NULL;
  CREATE TABLE recipes (id INTEGER PRIMARY KEY, name TEXT NOT NULL, type_id INTEGER NOT NULL REFERENCES recipe_types(id),
    yield_amount REAL CHECK (yield_amount IS NULL OR yield_amount > 0), yield_unit TEXT, steps TEXT,
    wait_days INTEGER CHECK (wait_days IS NULL OR wait_days >= 0),
    shelf_life_days INTEGER CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
    intention TEXT, timing_notes TEXT, notes TEXT, ${TS});
  CREATE INDEX idx_recipes_type ON recipes(type_id);
  CREATE TABLE recipe_ingredients (id INTEGER PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipes(id),
    herb_id INTEGER REFERENCES herbs(id), name TEXT NOT NULL, amount REAL CHECK (amount IS NULL OR amount >= 0),
    unit TEXT, form TEXT, plant_part TEXT, note TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    herb_gone INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
  CREATE INDEX idx_recipe_ingredients_herb ON recipe_ingredients(herb_id);
  `,
  // 5: the batch journal. A batch keeps its own name, lines and steps so it survives its recipe or jars being purged.
  `
  CREATE TABLE batches (id INTEGER PRIMARY KEY, recipe_id INTEGER REFERENCES recipes(id), type_id INTEGER REFERENCES recipe_types(id),
    name TEXT NOT NULL, start_date TEXT NOT NULL, factor REAL CHECK (factor IS NULL OR factor > 0),
    base TEXT, intention TEXT, method TEXT, noticed TEXT, would_change TEXT, label_notes TEXT, notes TEXT,
    finished_on TEXT, yield_amount REAL CHECK (yield_amount IS NULL OR yield_amount > 0), yield_unit TEXT,
    expires_on TEXT, item_id INTEGER REFERENCES items(id), ${TS});
  CREATE INDEX idx_batches_recipe ON batches(recipe_id);
  CREATE INDEX idx_batches_start ON batches(start_date);
  CREATE TABLE batch_ingredients (id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES batches(id),
    herb_id INTEGER REFERENCES herbs(id), name TEXT NOT NULL, amount REAL CHECK (amount IS NULL OR amount >= 0), unit TEXT,
    item_id INTEGER REFERENCES items(id), drawn_amount REAL CHECK (drawn_amount IS NULL OR drawn_amount >= 0), drawn_unit TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_batch_ingredients_batch ON batch_ingredients(batch_id);
  CREATE INDEX idx_batch_ingredients_item ON batch_ingredients(item_id);
  CREATE TABLE batch_steps (id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES batches(id), title TEXT NOT NULL,
    due_on TEXT, done_on TEXT, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_batch_steps_batch ON batch_steps(batch_id);
  CREATE INDEX idx_batch_steps_due ON batch_steps(due_on) WHERE done_on IS NULL;
  `,
  // 6: timing rules for the sky suggestions. Starter rules are seeded at startup; list columns hold JSON arrays.
  `
  CREATE TABLE timing_rules (id INTEGER PRIMARY KEY, slug TEXT, kind TEXT NOT NULL
    CHECK (kind IN ('phase_group','phase','moon_element','moon_sign','day_ruler','festival')),
    value TEXT NOT NULL, text TEXT NOT NULL, recipe_types TEXT NOT NULL DEFAULT '[]', planets TEXT NOT NULL DEFAULT '[]',
    elements TEXT NOT NULL DEFAULT '[]', weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
    sort_order INTEGER NOT NULL DEFAULT 0, is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE UNIQUE INDEX idx_timing_rules_slug ON timing_rules(slug) WHERE slug IS NOT NULL;
  `,
  // 7: to-do tasks. Auto tasks carry an auto_key naming their cause; dismissals remember keys she cleared.
  `
  CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, notes TEXT, due_on TEXT,
    repeat_kind TEXT NOT NULL DEFAULT 'none' CHECK (repeat_kind IN ('none','daily','weekly','monthly','new_moon','full_moon','festival')),
    repeat_days TEXT NOT NULL DEFAULT '[]', repeat_anchor_day INTEGER CHECK (repeat_anchor_day IS NULL OR repeat_anchor_day BETWEEN 1 AND 31),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
    related_type TEXT CHECK (related_type IS NULL OR related_type IN ('item','recipe','batch','herb')), related_id INTEGER,
    kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto')), auto_key TEXT,
    snoozed_until TEXT, done_on TEXT, spawned_id INTEGER, ${TS});
  CREATE UNIQUE INDEX idx_tasks_auto_key ON tasks(auto_key) WHERE auto_key IS NOT NULL AND deleted_at IS NULL;
  CREATE INDEX idx_tasks_due ON tasks(due_on) WHERE done_on IS NULL AND deleted_at IS NULL;
  CREATE TABLE task_dismissals (auto_key TEXT PRIMARY KEY, dismissed_on TEXT NOT NULL);
  ALTER TABLE items ADD COLUMN restock_count INTEGER NOT NULL DEFAULT 0;
  `,
];

export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = current; i < migrations.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migrations[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
