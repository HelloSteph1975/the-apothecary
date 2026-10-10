import { Router } from 'express';
import { idParam } from '../http.js';
import { check } from '../validate.js';
import {
  syncAutoTasks, listTasks, getTask, createTask, updateTask, completeTask, uncompleteTask, snoozeTask, dismissTask,
  deleteTask, restoreTask,
} from '../services/tasks.js';

export function tasksRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const { today } = check({ today: 'date!' }, req.query);
    const view = typeof req.query.view === 'string' && req.query.view ? req.query.view : 'today';
    syncAutoTasks(ctx.db, today);
    res.json(listTasks(ctx.db, view, today));
  });
  r.post('/', (req, res) => res.status(201).json(getTask(ctx.db, createTask(ctx.db, req.body), req.body?.today ?? undefined)));
  r.get('/:id', (req, res) => {
    const { today } = check({ today: 'date' }, req.query);
    res.json(getTask(ctx.db, idParam(req), today ?? undefined));
  });
  r.patch('/:id', (req, res) => res.json(getTask(ctx.db, updateTask(ctx.db, idParam(req), req.body), req.body?.today ?? undefined)));
  r.post('/:id/complete', (req, res) => res.json(completeTask(ctx.db, idParam(req), req.body)));
  r.post('/:id/uncomplete', (req, res) => res.json(uncompleteTask(ctx.db, idParam(req))));
  r.post('/:id/snooze', (req, res) => res.json(snoozeTask(ctx.db, idParam(req), req.body)));
  r.post('/:id/dismiss', (req, res) => {
    dismissTask(ctx, idParam(req), req.body);
    res.json({ ok: true });
  });
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    deleteTask(ctx, id, new Date().toISOString());
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    restoreTask(ctx, id);
    res.json(getTask(ctx.db, id));
  });
  return r;
}
