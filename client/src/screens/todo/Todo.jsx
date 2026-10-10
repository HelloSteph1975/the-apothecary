import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, DateInput } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useConfirm } from '../../components/ConfirmProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { formatDay } from '../../lib/cabinet.js';
import { AREAS, RELATED_OPTIONS, addDaysTo, dueLabel, relatedLink, repeatText, shortDay } from '../../lib/tasks.js';
import { TaskForm } from './TaskForm.jsx';
import { TaskCheck } from './TaskCheck.jsx';

export const VIEWS = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'area', label: 'By area' },
  { value: 'done', label: 'Done' },
];
const EMPTY = { today: 'Nothing due today. Enjoy the quiet.', upcoming: 'Nothing planned yet.', area: 'Nothing planned yet.', done: 'Nothing done yet.' };
const SNOOZES = [['1 day', 1], ['3 days', 3], ['1 week', 7]];
const RELATED_TYPES = RELATED_OPTIONS.map(o => o.value);

// Everything one task can do from a list or its own page, so rows and the task page agree.
export function useTaskActions({ onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const del = useDeleteWithUndo();
  const fail = err => toast.show({ message: err.message, duration: 6000 });
  return {
    async complete(task) {
      try {
        const res = await api.post(`/api/tasks/${task.id}/complete`, { today: todayString() });
        if (res.next?.due_on) toast.show({ message: `Next: ${formatDay(res.next.due_on)}` });
        onChange(res);
        return res;
      } catch (err) { fail(err); onChange(); return null; }
    },
    async uncomplete(task) {
      try { const res = await api.post(`/api/tasks/${task.id}/uncomplete`); onChange(res); return res; } catch (err) { fail(err); onChange(); return null; }
    },
    async snooze(task, until) {
      try {
        await api.post(`/api/tasks/${task.id}/snooze`, { until, today: todayString() });
        toast.show({ message: `Snoozed until ${shortDay(until, todayString())}` });
        onChange();
        return true;
      } catch (err) { fail(err); return false; }
    },
    async dismiss(task) {
      const ok = await confirm({ title: 'Dismiss this task?', body: 'Dismiss this? It comes back only if things change.', confirmLabel: 'Dismiss', danger: true });
      if (!ok) return false;
      try { await api.post(`/api/tasks/${task.id}/dismiss`, { today: todayString() }); onChange(); return true; } catch (err) { fail(err); return false; }
    },
    remove: (task, extra = {}) => del({ url: `/api/tasks/${task.id}`, label: task.title, onChange, ...extra }),
  };
}

function RowMenu({ task, actions }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [until, setUntil] = useState('');
  const root = useRef(null);
  const toggle = useRef(null);
  const listId = useId();
  const today = todayString();
  const close = (refocus = false) => {
    setOpen(false); setPicking(false);
    if (refocus) toggle.current?.focus();
  };
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') close(true); };
    const onDown = e => { if (root.current && !root.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  const done = async fn => { close(true); await fn(); };
  return (
    <div className="row-menu" ref={root} onBlur={() => { if (open) setTimeout(() => { if (root.current && !root.current.contains(document.activeElement)) close(); }, 0); }}>
      <Button ref={toggle} variant="secondary" size="sm" icon={MoreHorizontal} aria-label={`Actions for ${task.title}`}
        aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => (open ? close() : setOpen(true))} />
      {open && (
        <div className="row-menu-list" id={listId}>
          {!task.done_on && SNOOZES.map(([label, n]) => (
            <button key={label} type="button" className="row-menu-item" onClick={() => done(() => actions.snooze(task, addDaysTo(today, n)))}>Snooze {label}</button>
          ))}
          {!task.done_on && !picking && <button type="button" className="row-menu-item" onClick={() => setPicking(true)}>Pick a date</button>}
          {!task.done_on && picking && (
            <div className="row-menu-pick">
              <Field label="Snooze until"><DateInput ref={el => el?.focus()} min={addDaysTo(today, 1)} value={until} onChange={e => setUntil(e.target.value)} /></Field>
              <Button size="sm" disabled={!until} onClick={() => done(() => actions.snooze(task, until))}>Snooze until that day</Button>
            </div>
          )}
          {task.kind === 'auto' && !task.done_on && <button type="button" className="row-menu-item" onClick={() => done(() => actions.dismiss(task))}>Dismiss</button>}
          {task.kind !== 'auto' && <button type="button" className="row-menu-item row-menu-danger" onClick={() => done(() => actions.remove(task))}>Delete</button>}
        </div>
      )}
    </div>
  );
}

export function RelatedLink({ related }) {
  if (!related) return null;
  const to = relatedLink(related);
  if (!related.live || !to) return <span className="muted">{related.name ?? 'A record'} (removed)</span>;
  return <Link to={to}>{related.name}</Link>;
}

function TaskRow({ task, actions, today }) {
  const due = dueLabel(task, today);
  const repeat = repeatText(task);
  const asleep = !task.done_on && task.snoozed_until && task.snoozed_until > today;
  return (
    <li className="task-row">
      <TaskCheck task={task} actions={actions} />
      <div className="task-main">
        <Link to={`/todo/${task.id}`} className="task-title">{task.title}</Link>
        <div className="task-meta">
          {task.done_on
            ? <span>Done {shortDay(task.done_on, today)}</span>
            : <span className={due.overdue ? 'overdue' : undefined}>{due.text}</span>}
          {asleep && <span className="muted">Snoozed until {shortDay(task.snoozed_until, today)}</span>}
          {repeat && <span>{repeat}</span>}
          {task.priority === 'high' && <span className="badge badge-oxblood">High</span>}
          {task.kind === 'auto' && <span className="badge badge-brass">Automatic</span>}
          {task.related && <RelatedLink related={task.related} />}
        </div>
      </div>
      <RowMenu task={task} actions={actions} />
    </li>
  );
}

function TaskList({ tasks, actions, today }) {
  return <ul className="task-list">{tasks.map(t => <TaskRow key={t.id} task={t} actions={actions} today={today} />)}</ul>;
}

function readPrefill(params) {
  const due = params.get('due');
  const rel = /^(\w+):(\d+)$/.exec(params.get('related') ?? '');
  const prefill = {};
  if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) prefill.due = due;
  if (rel && RELATED_TYPES.includes(rel[1])) { prefill.related_type = rel[1]; prefill.related_id = Number(rel[2]); }
  return Object.keys(prefill).length ? prefill : null;
}

export function Todo() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('view');
  const view = VIEWS.some(v => v.value === requested) ? requested : 'today';
  const today = todayString();
  const { data, error, reload } = useApi(`/api/tasks?view=${view}&today=${today}`);
  const actions = useTaskActions({ onChange: () => reload() });
  const [form, setForm] = useState(() => { const p = readPrefill(params); return p ? { key: 1, prefill: p } : { key: 0, prefill: null }; });
  const [formOpen, setFormOpen] = useState(() => readPrefill(params) != null);

  const openForm = () => { setForm(f => ({ key: f.key + 1, prefill: null })); setFormOpen(true); };
  const closeForm = () => {
    setFormOpen(false);
    if (params.has('due') || params.has('related')) {
      const next = new URLSearchParams(params);
      next.delete('due'); next.delete('related');
      setParams(next, { replace: true });
    }
  };

  const header = <PageHeader title="To-do" subtitle="What needs doing, and when" actions={<Button onClick={openForm}>Add a task</Button>} />;
  const tabs = (
    <nav className="tabs" aria-label="To-do views">
      {VIEWS.map(v => (
        <Link key={v.value} to={`?view=${v.value}`} className="tab" aria-current={v.value === view ? 'page' : undefined}>{v.label}</Link>
      ))}
    </nav>
  );

  let body;
  if (error) body = <><p role="alert">{error.message}</p><Button onClick={reload}>Try again</Button></>;
  else if (!data) body = <p>Opening the to-do list…</p>;
  else if (view === 'area') {
    const groups = AREAS.filter(a => (data[a.key] ?? []).length > 0);
    body = groups.length === 0 ? <p className="muted">{EMPTY.area}</p> : groups.map(a => (
      <ParchmentCard key={a.key} title={a.label}><TaskList tasks={data[a.key]} actions={actions} today={today} /></ParchmentCard>
    ));
  } else if (data.length === 0) body = <p className="muted">{EMPTY[view]}</p>;
  else body = <ParchmentCard><TaskList tasks={data} actions={actions} today={today} /></ParchmentCard>;

  return (
    <>
      {header}
      {tabs}
      {body}
      <TaskForm key={form.key} prefill={form.prefill} open={formOpen} onClose={closeForm} onSaved={() => reload()} />
    </>
  );
}
