import { Router } from 'express';
import { idParam } from '../http.js';
import {
  planBatch, listBatches, getBatchDetail, createBatch, updateBatch, addStep, updateStep, deleteStep, restoreStep,
  finishBatch, unfinishBatch, deleteBatch, restoreBatch,
} from '../services/batches.js';

export function batchesRouter(ctx) {
  const r = Router();
  r.post('/plan', (req, res) => res.json(planBatch(ctx.db, req.body)));
  r.get('/', (req, res) => res.json(listBatches(ctx.db, req.query)));
  r.post('/', (req, res) => res.status(201).json(getBatchDetail(ctx.db, createBatch(ctx.db, req.body))));
  r.get('/:id', (req, res) => res.json(getBatchDetail(ctx.db, idParam(req))));
  r.patch('/:id', (req, res) => res.json(getBatchDetail(ctx.db, updateBatch(ctx.db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    deleteBatch(ctx, id, new Date().toISOString());
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    restoreBatch(ctx, id);
    res.json(getBatchDetail(ctx.db, id));
  });
  r.post('/:id/finish', (req, res) => {
    const id = idParam(req);
    finishBatch(ctx.db, id, req.body);
    res.json(getBatchDetail(ctx.db, id));
  });
  r.post('/:id/unfinish', (req, res) => {
    const id = idParam(req);
    unfinishBatch(ctx.db, id);
    res.json(getBatchDetail(ctx.db, id));
  });
  r.post('/:id/steps', (req, res) => res.status(201).json(addStep(ctx.db, idParam(req), req.body)));
  r.patch('/:id/steps/:stepId', (req, res) => res.json(updateStep(ctx.db, idParam(req), idParam(req, 'stepId'), req.body)));
  r.delete('/:id/steps/:stepId', (req, res) => {
    const id = idParam(req);
    const stepId = idParam(req, 'stepId');
    deleteStep(ctx.db, id, stepId);
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/steps/${stepId}/restore` });
  });
  r.post('/:id/steps/:stepId/restore', (req, res) => res.json(restoreStep(ctx.db, idParam(req), idParam(req, 'stepId'))));
  return r;
}
