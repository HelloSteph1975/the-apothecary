import { HttpError, notFound } from '../http.js';
import { transaction } from '../db/connection.js';

export function assertLive(db, table, id, field, label) {
  if (id == null) return;
  if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id)) {
    throw new HttpError(400, 'Please fix the highlighted fields.', { [field]: `That ${label} doesn't exist` });
  }
}

// Deletes a group (a cabinet section, a recipe type) after moving its live members into another live group.
// The move and the delete share one transaction; undo restores only the group, so moved members stay put.
export function deleteGroup(db, { repo, childTable, childKey, label, id, moveTo, stamp, messages }) {
  if (!repo.get(id)) throw notFound(messages.gone);
  const count = db.prepare(`SELECT COUNT(*) n FROM ${childTable} WHERE ${childKey} = ? AND deleted_at IS NULL`).get(id).n;
  if (count && !moveTo) throw new HttpError(409, messages.moveFirst, { [messages.countKey]: count });
  if (moveTo) {
    if (Number(moveTo) === id) throw new HttpError(400, messages.samePick);
    assertLive(db, repo.table, Number(moveTo), 'move_to', label);
  }
  transaction(db, () => {
    if (moveTo) {
      db.prepare(`UPDATE ${childTable} SET ${childKey} = ?, updated_at = datetime('now') WHERE ${childKey} = ? AND deleted_at IS NULL`)
        .run(Number(moveTo), id);
    }
    repo.remove(id, stamp);
  });
}

export function reorderGroups(db, repo, ids, message) {
  if (!Array.isArray(ids) || !ids.every(n => Number.isInteger(n))) throw new HttpError(400, message);
  transaction(db, () => ids.forEach((id, i) => repo.update(id, { sort_order: i })));
  return repo.list();
}
