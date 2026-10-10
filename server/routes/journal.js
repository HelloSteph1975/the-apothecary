import { Router } from 'express';
import { crudRouter } from './crud.js';
import { idParam, notFound, HttpError } from '../http.js';
import { check } from '../validate.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { journalTypeSchema } from '../schemas.js';
import {
  listJournalTypes, assertUniqueJournalTypeName, nextJournalTypeOrder, deleteJournalType, reorderJournalTypes,
} from '../services/journalTypes.js';
import { listEntries, listTags, getEntryDetail, createEntry, updateEntry, deleteEntry, restoreEntry } from '../services/journal.js';
import { queryDates } from './sky.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

const VIEWS = ['list', 'type', 'tag', 'moon'];
const GROUPS = ['new', 'waxing', 'full', 'waning'];

export function journalTypesRouter(ctx) {
  const r = Router();
  r.put('/order', (req, res) => res.json(reorderJournalTypes(ctx.db, req.body?.ids)));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    deleteJournalType(ctx.db, id, req.query.move_to, new Date().toISOString());
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).journalTypes,
    schema: journalTypeSchema,
    list: () => listJournalTypes(ctx.db),
    prepareCreate: data => ({ sort_order: nextJournalTypeOrder(ctx.db), ...data, slug: null, is_starter: 0 }),
    validateRow: (ctx, data, row) => assertUniqueJournalTypeName(ctx.db, data.name, row?.id ?? null),
    // Runs after the row is live again, inside the transaction, so a clash rolls the undo back.
    onRestore: (ctx, row) => assertUniqueJournalTypeName(ctx.db, row.name, row.id),
  }));
  return r;
}

const oneOf = (value, list, field) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !list.includes(value)) {
    throw new HttpError(400, 'Please fix the highlighted fields.', { [field]: `Must be one of: ${list.join(', ')}` });
  }
  return value;
};

export function journalRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const q = req.query;
    const text = k => (typeof q[k] === 'string' ? q[k] : undefined);
    check({ type_id: 'int', page: { type: 'int', min: 1, max: 100000 } }, { type_id: text('type_id'), page: text('page') });
    const { from, to } = queryDates(q, ['from', 'to']);
    res.json(listEntries(ctx.db, {
      view: oneOf(q.view, VIEWS, 'view'), q: text('q'), type_id: text('type_id'), tag: text('tag'),
      phase_group: oneOf(q.phase_group, GROUPS, 'phase_group'), from, to, page: text('page'),
    }));
  });
  r.get('/tags', (req, res) => res.json(listTags(ctx.db)));
  r.get('/:id', (req, res) => res.json(getEntryDetail(ctx.db, idParam(req))));
  r.post('/', (req, res) => res.status(201).json(getEntryDetail(ctx.db, createEntry(ctx.db, req.body))));
  r.patch('/:id', (req, res) => res.json(getEntryDetail(ctx.db, updateEntry(ctx.db, idParam(req), req.body))));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    if (!repos(ctx.db).journalEntries.get(id)) throw notFound('That entry is not in the journal.');
    const stamp = new Date().toISOString();
    transaction(ctx.db, () => {
      deleteEntry(ctx.db, id, stamp);
      cascadeDeletePhotos(ctx, 'journal', id, stamp);
    });
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = repos(ctx.db).journalEntries.get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw notFound('Nothing to undo');
    transaction(ctx.db, () => {
      restoreEntry(ctx.db, id, row.deleted_at);
      cascadeRestorePhotos(ctx, 'journal', id, row.deleted_at);
    });
    res.json(getEntryDetail(ctx.db, id));
  });
  return r;
}
