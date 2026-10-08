import { Router } from 'express';
import { HttpError } from '../http.js';
import { systemRouter } from './system.js';
import { settingsRouter } from './settings.js';
import { sectionsRouter, itemsRouter, purchasesRouter, expirySuggestionRoute, storageSpotsRoute } from './cabinet.js';
import { suppliersRouter } from './suppliers.js';

export function apiRouter(ctx, { onShutdown }) {
  const r = Router();
  r.get('/health', (req, res) => res.json({ ok: true, version: '0.1.0', demo: ctx.config.demo }));
  r.use('/settings', settingsRouter(ctx));
  r.use('/sections', sectionsRouter(ctx));
  r.use('/items', itemsRouter(ctx));
  r.use('/purchases', purchasesRouter(ctx));
  r.use('/suppliers', suppliersRouter(ctx));
  r.get('/expiry-suggestion', expirySuggestionRoute(ctx));
  r.get('/storage-spots', storageSpotsRoute(ctx));
  r.use(systemRouter(ctx, { onShutdown }));
  r.use((req, res, next) => next(new HttpError(404, 'No such API route')));
  return r;
}
