import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { notFound } from '../http.js';
import { LABEL_SIZES } from '../services/labelSizes.js';
import { getLabelData, parseIds } from '../services/labels.js';
import {
  validateLabelRequest, renderLabelPdf, savePdf, listSavedPdfs, labelsDir, LABEL_FILE, SAVE_FAILED,
} from '../services/labelPdf.js';

export function labelsRouter(ctx) {
  const r = Router();
  r.get('/sizes', (req, res) => res.json(LABEL_SIZES));
  r.get('/data', (req, res) => {
    res.json(getLabelData(ctx.db, { items: parseIds(req.query.items, 'items'), batches: parseIds(req.query.batches, 'batches') }));
  });
  r.post('/pdf', async (req, res, next) => {
    try {
      const request = validateLabelRequest(req.body);
      const { buffer, pages, printed } = await renderLabelPdf(request);
      let file;
      try {
        file = savePdf(ctx.config.dataDir, buffer);
      } catch {
        // Sent here, not through the error handler, so the plain message reaches her.
        return res.status(500).json({ error: SAVE_FAILED });
      }
      res.json({ file, pages, labels: printed });
    } catch (err) {
      next(err);
    }
  });
  r.get('/files', (req, res) => res.json(listSavedPdfs(ctx.config.dataDir)));
  r.get('/files/:name', (req, res) => {
    const { name } = req.params;
    if (!LABEL_FILE.test(name)) throw notFound('No such file');
    const full = path.join(labelsDir(ctx.config.dataDir), name);
    if (!fs.existsSync(full)) throw notFound('No such file');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"` });
    res.send(fs.readFileSync(full));
  });
  return r;
}
