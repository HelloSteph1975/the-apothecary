import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { transaction } from '../db/connection.js';
import { check } from '../validate.js';
import { HttpError, idParam, notFound } from '../http.js';
import { photoSchema } from '../schemas.js';
import { ALLOWED_TYPES, PHOTO_OWNERS, savePhotoFile, trashPhotoFile, restorePhotoFile, setCover } from '../services/photos.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export function uploadErrors(err, req, res, next) {
  if (err?.name === 'MulterError') {
    return next(err.code === 'LIMIT_FILE_SIZE'
      ? new HttpError(413, 'That photo is too big (15 MB max).')
      : new HttpError(400, 'That upload could not be read.'));
  }
  next(err);
}

const uploadFile = (req, res, next) => upload.single('file')(req, res, err => (err ? uploadErrors(err, req, res, next) : next()));

export function photosRouter(ctx) {
  const r = Router();
  r.post('/', uploadFile, (req, res) => {
    const body = req.body ?? {};
    const { owner_type, caption } = body;
    const owner_id = Number(body.owner_id);
    if (!req.file || !ALLOWED_TYPES.includes(req.file.mimetype)) throw new HttpError(400, 'Please choose a JPEG, PNG, WebP or GIF image.');
    const table = Object.hasOwn(PHOTO_OWNERS, owner_type) ? PHOTO_OWNERS[owner_type] : null;
    if (!table || !ctx.db.prepare(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(owner_id)) {
      throw new HttpError(400, 'That photo has nothing to belong to.');
    }
    const filename = savePhotoFile(ctx.config.dataDir, req.file.buffer, req.file.mimetype);
    try {
      const count = ctx.db.prepare('SELECT COUNT(*) n FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL').get(owner_type, owner_id).n;
      res.status(201).json(repos(ctx.db).photos.create({
        owner_type, owner_id, filename,
        caption: typeof caption === 'string' ? caption.trim() || null : null,
        sort_order: count, is_cover: count === 0 ? 1 : 0,
      }));
    } catch (err) {
      try { fs.rmSync(path.join(ctx.config.dataDir, 'photos', filename), { force: true }); } catch {}
      throw err;
    }
  });

  // Making a photo the cover clears the others for that owner.
  r.patch('/:id', (req, res, next) => {
    if (req.body?.is_cover !== true && req.body?.is_cover !== 1 && req.body?.is_cover !== 'true') return next();
    const photo = repos(ctx.db).photos.get(idParam(req));
    if (!photo) throw notFound();
    transaction(ctx.db, () => {
      setCover(ctx.db, photo);
      const { is_cover, ...rest } = check(photoSchema, req.body, { partial: true });
      if (Object.keys(rest).length) repos(ctx.db).photos.update(photo.id, rest);
    });
    res.json(repos(ctx.db).photos.get(photo.id));
  });

  r.use(crudRouter(ctx, {
    repo: db => repos(db).photos,
    schema: photoSchema,
    filters: ['owner_type', 'owner_id'],
    onDelete: (ctx, row) => {
      trashPhotoFile(ctx.config.dataDir, row.filename);
      if (row.is_cover) {
        const next = ctx.db.prepare('SELECT * FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL ORDER BY sort_order, id LIMIT 1').get(row.owner_type, row.owner_id);
        if (next) setCover(ctx.db, next);
      }
    },
    onRestore: (ctx, row) => restorePhotoFile(ctx.config.dataDir, row.filename),
  }));
  return r;
}
