import { Router } from 'express';
import { idParam } from '../http.js';
import {
  planBatch, listBatches, getBatchDetail, createBatch, updateBatch, addStep, updateStep, deleteStep, restoreStep,
  finishBatch, unfinishBatch, deleteBatch, restoreBatch,
} from '../services/batches.js';

export function batchesRouter(ctx) {
  const r = Router();
  const db = ctx.db;
  r.post('/plan', (req, res) => res.json(planBatch(db, req.body)));
  r.get('/', (req, res) => res.json(listBatches(db, req.query)));
  r.post('/', (req, res) => res.status(201).json(getBatchDetail(db, createBatch(db, req.body))));
  r.get('/:id', (req, res) => res.json(getBatchDetail(db, idParam(req))));
  r.patch('/:id', (req, res) => res.json(getBatchDetail(db, updateBatch(db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    deleteBatch(ctx, id, new Date().toISOString());
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    restoreBatch(ctx, id);
    res.json(getBatchDetail(db, id));
  });
  r.post('/:id/finish', (req, res) => {
    const id = idParam(req);
    finishBatch(db, id, req.body);
    res.json(getBatchDetail(db, id));
  });
  r.post('/:id/unfinish', (req, res) => {
    const id = idParam(req);
    unfinishBatch(db, id);
    res.json(getBatchDetail(db, id));
  });
  r.post('/:id/steps', (req, res) => res.status(201).json(addStep(db, idParam(req), req.body)));
  r.patch('/:id/steps/:stepId', (req, res) => res.json(updateStep(db, idParam(req), idParam(req, 'stepId'), req.body)));
  r.delete('/:id/steps/:stepId', (req, res) => {
    const id = idParam(req);
    const stepId = idParam(req, 'stepId');
    deleteStep(db, id, stepId);
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/steps/${stepId}/restore` });
  });
  r.post('/:id/steps/:stepId/restore', (req, res) => res.json(restoreStep(db, idParam(req), idParam(req, 'stepId'))));
  return r;
}
