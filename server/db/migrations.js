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
