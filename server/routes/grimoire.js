import { Router } from 'express';
import { check } from '../validate.js';
import { idParam, notFound } from '../http.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { listHerbs, getHerbDetail, createHerb, updateHerb, herbOfTheDay } from '../services/grimoire.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

const optionalToday = req => (typeof req.query.today === 'string' && req.query.today
  ? check({ today: 'date!' }, { today: req.query.today }).today : undefined);

export function herbsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listHerbs(ctx.db, req.query)));
  r.get('/:id', (req, res) => res.json(getHerbDetail(ctx.db, idParam(req), optionalToday(req))));
  r.post('/', (req, res) => res.status(201).json(getHerbDetail(ctx.db, createHerb(ctx.db, req.body))));
  r.patch('/:id', (req, res) => res.json(getHerbDetail(ctx.db, updateHerb(ctx.db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    if (!repos(ctx.db).herbs.get(id)) throw notFound();
    const stamp = new Date().toISOString();
    transaction(ctx.db, () => {
      repos(ctx.db).herbs.remove(id, stamp);
      cascadeDeletePhotos(ctx, 'herb', id, stamp);
    });
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = repos(ctx.db).herbs.get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw notFound('Nothing to undo');
    transaction(ctx.db, () => {
      repos(ctx.db).herbs.restore(id);
      cascadeRestorePhotos(ctx, 'herb', id, row.deleted_at);
    });
    res.json(getHerbDetail(ctx.db, id));
  });
  return r;
}

export const herbOfTheDayRoute = ctx => (req, res) => {
  const { today } = check({ today: 'date!' }, req.query);
  res.json(herbOfTheDay(ctx.db, today));
};
