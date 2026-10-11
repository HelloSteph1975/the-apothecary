import { Router } from 'express';
import { idParam, HttpError } from '../http.js';
import { check } from '../validate.js';
import { repos } from '../db/repos.js';
import {
  getShoppingList, getShoppingItem, createShoppingItem, updateShoppingItem, deleteShoppingItem, restoreShoppingItem,
  setChecked, clearChecked, undoClear, jarPrefill,
} from '../services/shopping.js';

export function shoppingRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const group = typeof req.query.group === 'string' && req.query.group !== '' ? req.query.group : undefined;
    res.json(getShoppingList(ctx.db, { group }));
  });
  r.post('/items', (req, res) => res.status(201).json(getShoppingItem(ctx.db, createShoppingItem(ctx.db, req.body))));
  r.patch('/items/:id', (req, res) => res.json(getShoppingItem(ctx.db, updateShoppingItem(ctx.db, idParam(req), req.body))));
  r.delete('/items/:id', (req, res) => {
    const id = idParam(req);
    deleteShoppingItem(ctx.db, id, new Date().toISOString());
    res.json({ ok: true, restore: `${req.baseUrl}/items/${id}/restore` });
  });
  r.post('/items/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = repos(ctx.db).shoppingItems.get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw new HttpError(404, 'Nothing to undo');
    restoreShoppingItem(ctx.db, id);
    res.json(getShoppingItem(ctx.db, id));
  });
  r.get('/items/:id/jar', (req, res) => res.json(jarPrefill(ctx.db, idParam(req))));
  r.post('/check', (req, res) => {
    const body = check({ key: 'string!', checked: { type: 'bool', required: true } }, req.body);
    setChecked(ctx.db, body.key, Boolean(body.checked));
    res.json({ key: body.key, checked: Boolean(body.checked) });
  });
  r.post('/clear', (req, res) => res.json(clearChecked(ctx.db)));
  r.post('/clear/undo', (req, res) => res.json(undoClear(ctx.db, req.body?.stamp)));
  return r;
}
