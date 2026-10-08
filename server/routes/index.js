import { Router } from 'express';
import { HttpError } from '../http.js';
import { systemRouter } from './system.js';

export function apiRouter(ctx, { onShutdown }) {
  const r = Router();
  r.get('/health', (req, res) => res.json({ ok: true, version: '0.1.0', demo: ctx.config.demo }));
  r.use(systemRouter(ctx, { onShutdown }));
  r.use((req, res, next) => next(new HttpError(404, 'No such API route')));
  return r;
}
