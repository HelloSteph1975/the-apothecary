import { Router } from 'express';
import { crudRouter } from './crud.js';
import { idParam, notFound } from '../http.js';
import { check } from '../validate.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { recipeTypeSchema } from '../schemas.js';
import {
  listRecipeTypes, assertUniqueTypeName, nextTypeOrder, deleteRecipeType, reorderRecipeTypes,
} from '../services/recipeTypes.js';
import { listRecipes, getRecipeDetail, createRecipe, updateRecipe, deleteRecipe, restoreRecipe } from '../services/recipes.js';
import { startDates } from '../services/timing.js';
import { getSettings } from '../services/settings.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

export function recipeTypesRouter(ctx) {
  const r = Router();
  r.put('/order', (req, res) => res.json(reorderRecipeTypes(ctx.db, req.body?.ids)));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    deleteRecipeType(ctx.db, id, req.query.move_to, new Date().toISOString());
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).recipeTypes,
    schema: recipeTypeSchema,
    list: () => listRecipeTypes(ctx.db),
    prepareCreate: data => ({ sort_order: nextTypeOrder(ctx.db), ...data, slug: null, is_starter: 0 }),
    validateRow: (ctx, data, row) => assertUniqueTypeName(ctx.db, data.name, row?.id ?? null),
    // Runs after the row is live again, inside the transaction, so a clash rolls the undo back.
    onRestore: (ctx, row) => assertUniqueTypeName(ctx.db, row.name, row.id),
  }));
  return r;
}

export function recipesRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const q = req.query;
    check({ type_id: 'int', herb_id: 'int' }, {
      type_id: typeof q.type_id === 'string' ? q.type_id : undefined, herb_id: typeof q.herb_id === 'string' ? q.herb_id : undefined,
    });
    res.json(listRecipes(ctx.db, q));
  });
  r.get('/:id/start-dates', (req, res) => {
    const id = idParam(req);
    const { from } = check({ from: 'date' }, { from: typeof req.query.from === 'string' ? req.query.from : undefined });
    res.json(startDates(ctx.db, id, { from }, getSettings(ctx.db)));
  });
  r.get('/:id', (req, res) => res.json(getRecipeDetail(ctx.db, idParam(req), req.query)));
  r.post('/', (req, res) => res.status(201).json(getRecipeDetail(ctx.db, createRecipe(ctx.db, req.body))));
  r.patch('/:id', (req, res) => res.json(getRecipeDetail(ctx.db, updateRecipe(ctx.db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    if (!repos(ctx.db).recipes.get(id)) throw notFound('That recipe is not in the book.');
    const stamp = new Date().toISOString();
    transaction(ctx.db, () => {
      deleteRecipe(ctx.db, id, stamp);
      cascadeDeletePhotos(ctx, 'recipe', id, stamp);
    });
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = repos(ctx.db).recipes.get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw notFound('Nothing to undo');
    transaction(ctx.db, () => {
      restoreRecipe(ctx.db, id, row.deleted_at);
      cascadeRestorePhotos(ctx, 'recipe', id, row.deleted_at);
    });
    res.json(getRecipeDetail(ctx.db, id));
  });
  return r;
}
