import { Router } from 'express';
import { idParam, HttpError } from '../http.js';
import { check } from '../validate.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { getSettings } from '../services/settings.js';
import {
  listPlants, getPlantDetail, createPlant, updatePlant, deletePlant, restorePlant,
  listEntries, entryOptions, getEntryDetail, createEntry, updateEntry, deleteEntry, restoreEntry, jarPrefill, gardenSuggestions,
} from '../services/garden.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';
import { queryDates } from './sky.js';

const text = (q, k) => (typeof q[k] === 'string' && q[k] !== '' ? q[k] : undefined);

function plantsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listPlants(ctx.db, { status: text(req.query, 'status') })));
  r.get('/:id', (req, res) => res.json(getPlantDetail(ctx.db, idParam(req))));
  r.post('/', (req, res) => res.status(201).json(getPlantDetail(ctx.db, createPlant(ctx.db, req.body))));
  r.patch('/:id', (req, res) => res.json(getPlantDetail(ctx.db, updatePlant(ctx.db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    const stamp = new Date().toISOString();
    transaction(ctx.db, () => {
      deletePlant(ctx.db, id, stamp);
      cascadeDeletePhotos(ctx, 'garden_plant', id, stamp);
    });
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = repos(ctx.db).gardenPlants.get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw new HttpError(404, 'Nothing to undo');
    transaction(ctx.db, () => {
      restorePlant(ctx.db, id);
      cascadeRestorePhotos(ctx, 'garden_plant', id, row.deleted_at);
    });
    res.json(getPlantDetail(ctx.db, id));
  });
  return r;
}

function entriesRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const q = req.query;
    const ints = check({ plant_id: 'int', herb_id: 'int', page: { type: 'int', min: 1, max: 100000 } },
      { plant_id: text(q, 'plant_id'), herb_id: text(q, 'herb_id'), page: text(q, 'page') });
    const { from, to } = queryDates(q, ['from', 'to']);
    res.json(listEntries(ctx.db, { kind: text(q, 'kind'), ...ints, from, to }));
  });
  r.get('/options', (req, res) => res.json(entryOptions(ctx.db)));
  r.get('/:id', (req, res) => res.json(getEntryDetail(ctx.db, idParam(req))));
  r.get('/:id/jar', (req, res) => res.json(jarPrefill(ctx.db, idParam(req))));
  r.post('/', (req, res) => res.status(201).json(getEntryDetail(ctx.db, createEntry(ctx.db, req.body))));
  r.patch('/:id', (req, res) => res.json(getEntryDetail(ctx.db, updateEntry(ctx.db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    const stamp = new Date().toISOString();
    transaction(ctx.db, () => {
      deleteEntry(ctx.db, id, stamp);
      cascadeDeletePhotos(ctx, 'garden_entry', id, stamp);
    });
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = repos(ctx.db).gardenEntries.get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw new HttpError(404, 'Nothing to undo');
    transaction(ctx.db, () => {
      restoreEntry(ctx.db, id);
      cascadeRestorePhotos(ctx, 'garden_entry', id, row.deleted_at);
    });
    res.json(getEntryDetail(ctx.db, id));
  });
  return r;
}

export function gardenRouter(ctx) {
  const r = Router();
  r.use('/plants', plantsRouter(ctx));
  r.use('/entries', entriesRouter(ctx));
  r.get('/suggestions', (req, res) => {
    const { days } = check({ days: 'int' }, { days: text(req.query, 'days') });
    const { from } = queryDates(req.query, ['from']);
    res.json(gardenSuggestions(ctx.db, { from, days: days ?? undefined }, getSettings(ctx.db)));
  });
  return r;
}
