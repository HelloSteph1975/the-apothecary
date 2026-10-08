import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { idParam } from '../http.js';
import { supplierSchema } from '../schemas.js';
import { listSuppliers, getSupplierDetail } from '../services/suppliers.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

export function suppliersRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listSuppliers(ctx.db)));
  r.get('/:id', (req, res) => res.json(getSupplierDetail(ctx.db, idParam(req))));
  r.use(crudRouter(ctx, {
    repo: db => repos(db).suppliers,
    schema: supplierSchema,
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'supplier', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'supplier', row.id, row.deleted_at),
  }));
  return r;
}
