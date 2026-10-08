import { Router } from 'express';
import { getSettings, saveSettings } from '../services/settings.js';

export function settingsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(getSettings(ctx.db)));
  r.put('/', (req, res) => res.json(saveSettings(ctx.db, req.body)));
  return r;
}
