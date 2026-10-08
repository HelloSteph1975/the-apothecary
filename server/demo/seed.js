import { transaction } from '../db/connection.js';
import { saveSettings } from '../services/settings.js';

const DEMO_SETTINGS = { keeper_name: 'Demo Keeper', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };

// Seeds the demo folder once (or again with reset). Later stages add sample herbs, jars and batches here.
export function seedDemo(ctx, { reset = false } = {}) {
  const db = ctx.db;
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get();
  if (seeded && !reset) return false;
  transaction(db, () => {
    saveSettings(db, DEMO_SETTINGS);
    db.prepare("INSERT INTO settings (key, value) VALUES ('demo_seeded', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
  });
  return true;
}
