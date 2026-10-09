import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { saveSettings } from '../services/settings.js';
import { createItem } from '../services/cabinet.js';
import { addDays, addMonths } from '../lib/dates.js';

const DEMO_SETTINGS = { keeper_name: 'Demo Keeper', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };

// The local calendar date, the same way the client works out "today".
function localToday(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Clears what the demo stocks (not the sections) so a reset doesn't double up.
function clearCabinet(db) {
  db.exec(`DELETE FROM purchases; DELETE FROM items; DELETE FROM suppliers;
    DELETE FROM photos WHERE owner_type IN ('item', 'supplier')`);
}

function stockCabinet(db, today) {
  const r = repos(db);
  const section = name => {
    const row = r.sections.list().find(s => s.name === name);
    if (!row) throw new Error(`Demo needs a "${name}" section`);
    return row.id;
  };
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
}

// Seeds the demo folder once (or again with reset). Later stages add sample batches here.
export function seedDemo(ctx, { reset = false } = {}) {
  const db = ctx.db;
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get();
  if (seeded && !reset) return false;
  transaction(db, () => {
    saveSettings(db, DEMO_SETTINGS);
    clearCabinet(db);
    stockCabinet(db, localToday());
    db.prepare("INSERT INTO settings (key, value) VALUES ('demo_seeded', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
  });
  return true;
}
