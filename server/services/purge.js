import fs from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/connection.js';
import { photosInBackups } from './backup.js';

// Removes records deleted more than `days` ago (children before parents), and photo files unless a kept backup still needs them.
export function purgeSoftDeleted(db, dataDir, { days = 30, now = Date.now() } = {}) {
  const cutoff = new Date(now - days * 86400000).toISOString();
  let files = [];
  const counts = transaction(db, () => {
    const old = table => `SELECT id FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < '${cutoff}'`;
    const photoMatch = `(deleted_at IS NOT NULL AND deleted_at < ?)
      OR (owner_type = 'item' AND owner_id IN (${old('items')}))
      OR (owner_type = 'supplier' AND owner_id IN (${old('suppliers')}))
      OR (owner_type = 'herb' AND owner_id IN (${old('herbs')}))
      OR (owner_type = 'recipe' AND owner_id IN (${old('recipes')}))
      OR (owner_type = 'batch' AND owner_id IN (${old('batches')}))
      OR (owner_type = 'task' AND owner_id IN (${old('tasks')}))`;
    files = db.prepare(`SELECT filename FROM photos WHERE ${photoMatch}`).all(cutoff).map(r => r.filename);
    const counts = {};
    counts.photos = db.prepare(`DELETE FROM photos WHERE ${photoMatch}`).run(cutoff).changes;
    for (const [type, table] of [['item', 'items'], ['recipe', 'recipes'], ['batch', 'batches'], ['herb', 'herbs']]) {
      db.prepare(`UPDATE tasks SET related_type = NULL, related_id = NULL WHERE related_type = '${type}' AND related_id IN (${old(table)})`).run();
    }
    counts.tasks = db.prepare(`DELETE FROM tasks WHERE id IN (${old('tasks')})`).run().changes;
    counts.purchases = db.prepare(`DELETE FROM purchases WHERE id IN (${old('purchases')}) OR item_id IN (${old('items')})`).run().changes;
    db.prepare(`UPDATE batches SET item_id = NULL WHERE item_id IN (${old('items')})`).run();
    db.prepare(`UPDATE batch_ingredients SET item_id = NULL WHERE item_id IN (${old('items')})`).run();
    counts.items = db.prepare(`DELETE FROM items WHERE id IN (${old('items')})`).run().changes;
    db.prepare(`UPDATE purchases SET supplier_id = NULL WHERE supplier_id IN (${old('suppliers')})`).run();
    counts.suppliers = db.prepare(`DELETE FROM suppliers WHERE id IN (${old('suppliers')})`).run().changes;
    counts.cabinet_sections = db.prepare(`DELETE FROM cabinet_sections WHERE id IN (${old('cabinet_sections')})
      AND id NOT IN (SELECT section_id FROM items)`).run().changes;
    db.prepare(`DELETE FROM recipe_ingredients WHERE id IN (${old('recipe_ingredients')}) OR recipe_id IN (${old('recipes')})`).run();
    db.prepare(`DELETE FROM batch_ingredients WHERE id IN (${old('batch_ingredients')}) OR batch_id IN (${old('batches')})`).run();
    db.prepare(`DELETE FROM batch_steps WHERE id IN (${old('batch_steps')}) OR batch_id IN (${old('batches')})`).run();
    counts.batches = db.prepare(`DELETE FROM batches WHERE id IN (${old('batches')})`).run().changes;
    db.prepare(`UPDATE batches SET recipe_id = NULL WHERE recipe_id IN (${old('recipes')})`).run();
    counts.recipes = db.prepare(`DELETE FROM recipes WHERE id IN (${old('recipes')})`).run().changes;
    const typeGone = `id IN (${old('recipe_types')})
      AND id NOT IN (SELECT type_id FROM recipes)
      AND id NOT IN (SELECT type_id FROM batches WHERE type_id IS NOT NULL)`;
    // SQLite may reuse a purged type's id, so a rule's `type-<id>` key must not outlive the type.
    const goneKeys = new Set(db.prepare(`SELECT id FROM recipe_types WHERE ${typeGone}`).all().map(r => `type-${r.id}`));
    if (goneKeys.size) {
      const setList = db.prepare('UPDATE timing_rules SET recipe_types = ? WHERE id = ?');
      for (const rule of db.prepare('SELECT id, recipe_types FROM timing_rules').all()) {
        let list;
        try { list = JSON.parse(rule.recipe_types); } catch { continue; }
        if (!Array.isArray(list)) continue;
        const next = list.filter(k => !goneKeys.has(k));
        if (next.length !== list.length) setList.run(JSON.stringify(next), rule.id);
      }
    }
    counts.recipe_types = db.prepare(`DELETE FROM recipe_types WHERE ${typeGone}`).run().changes;
    counts.timing_rules = db.prepare(`DELETE FROM timing_rules WHERE id IN (${old('timing_rules')})`).run().changes;
    db.prepare(`DELETE FROM herb_sources WHERE id IN (${old('herb_sources')}) OR herb_id IN (${old('herbs')})`).run();
    db.prepare(`UPDATE items SET herb_id = NULL WHERE herb_id IN (${old('herbs')})`).run();
    db.prepare(`UPDATE recipe_ingredients SET herb_id = NULL, herb_gone = 1 WHERE herb_id IN (${old('herbs')})`).run();
    db.prepare(`UPDATE batch_ingredients SET herb_id = NULL WHERE herb_id IN (${old('herbs')})`).run();
    counts.herbs = db.prepare(`DELETE FROM herbs WHERE id IN (${old('herbs')})`).run().changes;
    // A dismissal key names its cause (step:<id>:..., restock:<id>:..., expiry:<id>:...). Keep it while the cause row still exists.
    const stepIds = new Set(db.prepare('SELECT id FROM batch_steps').all().map(r => r.id));
    const itemIds = new Set(db.prepare('SELECT id FROM items').all().map(r => r.id));
    const dropKey = db.prepare('DELETE FROM task_dismissals WHERE auto_key = ?');
    for (const { auto_key } of db.prepare('SELECT auto_key FROM task_dismissals').all()) {
      const [source, id] = auto_key.split(':');
      const known = source === 'step' ? stepIds : source === 'restock' || source === 'expiry' ? itemIds : null;
      if (known && !known.has(Number(id))) dropKey.run(auto_key);
    }
    return counts;
  });
  const live = path.join(dataDir, 'photos');
  const trash = path.join(live, '_trash');
  const keep = files.length ? photosInBackups(dataDir) : new Set();
  for (const f of files) {
    try {
      if (keep.has(f)) {
        if (fs.existsSync(path.join(live, f))) fs.renameSync(path.join(live, f), path.join(trash, f));
        continue;
      }
      for (const dir of [live, trash]) fs.rmSync(path.join(dir, f), { force: true });
    } catch {}
  }
  return counts;
}

// Empties trash files older than the cutoff, except ones a kept backup still refers to.
export function purgeTrash(dataDir, olderThanDays = 30, now = Date.now()) {
  const dir = path.join(dataDir, 'photos', '_trash');
  if (!fs.existsSync(dir)) return 0;
  const old = fs.readdirSync(dir).filter(f => now - fs.statSync(path.join(dir, f)).mtimeMs > olderThanDays * 86400000);
  if (!old.length) return 0;
  const keep = photosInBackups(dataDir);
  let n = 0;
  for (const f of old) {
    if (keep.has(f)) continue;
    fs.rmSync(path.join(dir, f), { force: true });
    n++;
  }
  return n;
}
