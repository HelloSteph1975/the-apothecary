import { Router } from 'express';
import { HttpError } from '../http.js';
import { check } from '../validate.js';
import { queryDates } from './sky.js';
import { listGallery, galleryKinds, GALLERY_KINDS } from '../services/gallery.js';

export function galleryRouter(ctx) {
  const r = Router();
  r.get('/kinds', (req, res) => res.json(galleryKinds(ctx.db)));
  r.get('/', (req, res) => {
    const q = req.query;
    const text = k => (typeof q[k] === 'string' && q[k] !== '' ? q[k] : undefined);
    check({ page: { type: 'int', min: 1, max: 100000 } }, { page: text('page') });
    if (q.kind !== undefined && q.kind !== '' && (typeof q.kind !== 'string' || !GALLERY_KINDS.includes(q.kind))) {
      throw new HttpError(400, 'Please fix the highlighted fields.', { kind: `Must be one of: ${GALLERY_KINDS.join(', ')}` });
    }
    const { from, to } = queryDates(q, ['from', 'to']);
    res.json(listGallery(ctx.db, { kind: text('kind'), from, to, page: text('page') }));
  });
  return r;
}
