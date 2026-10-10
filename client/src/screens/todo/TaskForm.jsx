import { useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, TextArea, DateInput, Select, Checkbox } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { todayString } from '../../lib/today.js';
import { WEEKDAYS, REPEAT_OPTIONS, PRIORITY_OPTIONS, RELATED_OPTIONS } from '../../lib/tasks.js';

const LISTS = {
  item: today => [`/api/items?today=${today}`, 'name'],
  recipe: () => ['/api/recipes', 'name'],
  batch: () => ['/api/batches', 'name'],
  herb: () => ['/api/herbs', 'common_name'],
};
const orNull = v => (v.trim() === '' ? null : v.trim());

function initial(task, prefill) {
  if (task) {
    return {
      title: task.title, notes: task.notes ?? '', due_on: task.due_on ?? '', repeat_kind: task.repeat_kind, repeat_days: task.repeat_days ?? [],
      priority: task.priority, related_type: task.related?.type ?? '', related_id: task.related ? String(task.related.id) : '',
    };
  }
  return {
    title: '', notes: '', due_on: prefill?.due ?? '', repeat_kind: 'none', repeat_days: [], priority: 'normal',
    related_type: prefill?.related_type ?? '', related_id: prefill?.related_id ? String(prefill.related_id) : '',
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Add and edit in one dialog. It stays mounted; the parent gives it a new key each time it opens.
export function TaskForm({ task = null, prefill = null, open, onClose, onSaved }) {
  const toast = useToast();
  const auto = task?.kind === 'auto';
  const [start] = useState(() => initial(task, prefill));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const today = todayString();
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  useLeaveGuard(open && !same(form, start));

  const list = open && form.related_type ? LISTS[form.related_type](today) : null;
  const records = useApi(list ? list[0] : null);
  const options = (records.data ?? []).map(r => ({ value: String(r.id), label: r[list[1]] }));
  // Keep the record she already chose in the list, even if the list no longer carries it.
  if (form.related_id && task?.related && String(task.related.id) === form.related_id && task.related.type === form.related_type
    && records.data && !options.some(o => o.value === form.related_id)) {
    options.unshift({ value: form.related_id, label: task.related.name ?? 'Removed record' });
  }

  async function save(e) {
    e.preventDefault();
    if (busy.current) return;
    setFormError('');
    const title = form.title.trim();
    if (!title) { setErrors({ title: 'Write what needs doing.' }); return; }
    if (!auto && form.repeat_kind === 'weekly' && form.repeat_days.length === 0) { setErrors({ repeat_days: 'Pick at least one day.' }); return; }
    if (!auto && form.related_type && !form.related_id) { setErrors({ related_id: 'Pick one.' }); return; }
    const body = auto
      ? { title, notes: orNull(form.notes), priority: form.priority }
      : {
        title, notes: orNull(form.notes), due_on: form.due_on || null, repeat_kind: form.repeat_kind,
        repeat_days: form.repeat_kind === 'weekly' ? [...form.repeat_days].sort((a, b) => a - b) : [],
        priority: form.priority, related_type: form.related_type || null, related_id: form.related_type ? Number(form.related_id) : null, today,
      };
    busy.current = true;
    setSaving(true);
    try {
      const saved = task ? await api.patch(`/api/tasks/${task.id}`, body) : await api.post('/api/tasks', body);
      onSaved?.(saved);
      toast.show({ message: task ? 'Saved' : `Added ${title}` });
      onClose();
    } catch (ex) {
      const details = ex.details ?? {};
      setErrors(details);
      if (Object.keys(details).length === 0) setFormError(ex.message);
    } finally { busy.current = false; setSaving(false); }
  }

  const toggleDay = n => set('repeat_days', form.repeat_days.includes(n) ? form.repeat_days.filter(x => x !== n) : [...form.repeat_days, n]);

  return (
    <Dialog open={open} onClose={onClose} title={task ? 'Edit task' : 'Add a task'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="task-form" disabled={saving}>Save</Button></>}>
      <form id="task-form" onSubmit={save} noValidate>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        {auto && <p className="muted">{task.related ? `Made by the app from ${task.related.name ?? 'a record that is gone'}` : 'Made by the app'}</p>}
        <Field label="Title" error={errors.title}>
          <TextInput data-autofocus value={form.title} onChange={e => set('title', e.target.value)} />
        </Field>
        <Field label="Notes" error={errors.notes}>
          <TextArea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        {!auto && (
          <>
            <Field label="Due date" error={errors.due_on}>
              <DateInput value={form.due_on} onChange={e => set('due_on', e.target.value)} />
            </Field>
            <Field label="Repeat" error={errors.repeat_kind}>
              <Select value={form.repeat_kind} onChange={e => set('repeat_kind', e.target.value)} options={REPEAT_OPTIONS} />
            </Field>
            {form.repeat_kind === 'weekly' && (
              <fieldset className="check-group">
                <legend>Repeat on</legend>
                <div className="check-group-options">
                  {WEEKDAYS.map((name, n) => <Checkbox key={name} label={name} checked={form.repeat_days.includes(n)} onChange={() => toggleDay(n)} />)}
                </div>
                {errors.repeat_days && <small className="field-error" role="alert">{errors.repeat_days}</small>}
              </fieldset>
            )}
          </>
        )}
        <Field label="Priority" error={errors.priority}>
          <Select value={form.priority} onChange={e => set('priority', e.target.value)} options={PRIORITY_OPTIONS} />
        </Field>
        {!auto && (
          <>
            <Field label="Related to" error={errors.related_type}>
              <Select placeholder="Nothing in particular" value={form.related_type}
                onChange={e => setForm(f => ({ ...f, related_type: e.target.value, related_id: '' }))} options={RELATED_OPTIONS} />
            </Field>
            {form.related_type && (
              <Field label="Which one" error={errors.related_id}>
                <Select placeholder="Choose…" value={form.related_id} onChange={e => set('related_id', e.target.value)} options={options} />
              </Field>
            )}
            {records.error && (
              <p role="alert" className="field-error">Could not load the list. <Button type="button" variant="secondary" size="sm" onClick={records.reload}>Try again</Button></p>
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}
