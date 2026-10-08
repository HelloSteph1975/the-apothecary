import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { check } from '../validate.js';
import { HttpError, idParam } from '../http.js';
import { sectionSchema, purchaseSchema } from '../schemas.js';
import { getSettings } from '../services/settings.js';
import {
  listItems, getItemDetail, createItem, updateItem, restockItem, suggestExpiry, storageSpots,
  deleteSection, reorderSections,
} from '../services/cabinet.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

const today = req => check({ today: 'date!' }, { today: req.query.today }).today;

export function sectionsRouter(ctx) {
  const r = Router();
  r.put('/order', (req, res) => res.json(reorderSections(ctx.db, req.body?.ids)));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    const stamp = new Date().toISOString();
    deleteSection(ctx.db, id, req.query.move_to, stamp);
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).sections,
    schema: sectionSchema,
    prepareCreate: data => ({
      kind: 'supply',
      sort_order: ctx.db.prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) n FROM cabinet_sections WHERE deleted_at IS NULL').get().n,
      ...data,
    }),
  }));
  return r;
}

export function itemsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listItems(ctx.db, { ...req.query, include_used_up: req.query.include_used_up === '1' }, today(req))));
  r.get('/:id', (req, res) => res.json(getItemDetail(ctx.db, idParam(req), today(req))));
  r.post('/', (req, res) => res.status(201).json(createItem(ctx.db, req.body)));
  r.patch('/:id', (req, res) => res.json(updateItem(ctx.db, idParam(req), req.body)));
  r.post('/:id/restock', (req, res) => res.json(restockItem(ctx.db, idParam(req), req.body)));
  r.use(crudRouter(ctx, {
    repo: db => repos(db).items,
    schema: {},
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'item', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'item', row.id, row.deleted_at),
  }));
  return r;
}

export function purchasesRouter(ctx) {
  return crudRouter(ctx, {
    repo: db => repos(db).purchases,
    schema: purchaseSchema,
    validateRow: (ctx, row) => {
      if (row.supplier_id != null && !ctx.db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(row.supplier_id)) {
        throw new HttpError(400, 'Please fix the highlighted fields.', { supplier_id: "That supplier doesn't exist" });
      }
    },
  });
}

export function expirySuggestionRoute(ctx) {
  return (req, res) => {
    const { form, acquired_on } = check({ form: 'string', acquired_on: 'date!' }, req.query);
    res.json({ expires_on: suggestExpiry(form, acquired_on, getSettings(ctx.db)) });
  };
}

export const storageSpotsRoute = ctx => (req, res) => res.json(storageSpots(ctx.db));
