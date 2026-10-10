import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, DateInput, Checkbox } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { formatShortDay } from '../../lib/cabinet.js';
import { isOverdue } from '../../lib/batches.js';
import { todayString } from '../../lib/today.js';

function StepForm({ step, onSave, onCancel }) {
  const [title, setTitle] = useState(step?.title ?? '');
  const [dueOn, setDueOn] = useState(step?.due_on ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (!title.trim()) { setErrors({ title: 'Give this step a name.' }); return; }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), due_on: dueOn || null });
    } catch (ex) {
      setErrors(ex.details && Object.keys(ex.details).length ? ex.details : { form: ex.message });
      setSaving(false);
    }
  }

  return (
    <form className="step-form" onSubmit={submit} noValidate>
      {errors.form && <p role="alert" className="field-error">{errors.form}</p>}
      <Field label="Step" error={errors.title}>
        <TextInput data-autofocus value={title} onChange={e => { setTitle(e.target.value); setErrors({}); }} />
      </Field>
      <Field label="Due on" error={errors.due_on}><DateInput value={dueOn} onChange={e => setDueOn(e.target.value)} /></Field>
      <div className="step-form-actions">
        <Button type="submit" disabled={saving}>Save step</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// The batch's checklist: tick steps off, add, edit or delete them. Every change reloads the batch.
export function StepsEditor({ batchId, steps, onChange }) {
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [editing, setEditing] = useState(null); // a step id, or 'new'
  const [busy, setBusy] = useState(null);
  const today = todayString();
  const base = `/api/batches/${batchId}/steps`;

  const fail = err => toast.show({ message: err.message, duration: 6000 });
  async function toggle(step, checked) {
    if (busy) return;
    setBusy(step.id);
    try { await api.patch(`${base}/${step.id}`, { done_on: checked ? today : null }); onChange(); } catch (err) { fail(err); } finally { setBusy(null); }
  }
  const save = id => async body => {
    if (id === 'new') await api.post(base, body); else await api.patch(`${base}/${id}`, body);
    setEditing(null);
    onChange();
  };

  return (
    <>
      {steps.length === 0 && editing !== 'new' && <p className="muted">No steps yet.</p>}
      <ul className="step-list">
        {steps.map(s => (editing === s.id ? (
          <li key={s.id}><StepForm step={s} onSave={save(s.id)} onCancel={() => setEditing(null)} /></li>
        ) : (
          <li key={s.id} className={`step-row${s.done_on ? ' is-done' : ''}`}>
            <Checkbox label="Done" checked={Boolean(s.done_on)} disabled={busy === s.id} onChange={e => toggle(s, e.target.checked)} />
            <span className="step-main">
              <strong>{s.title}</strong>
              {s.done_on ? <span className="muted"> done {formatShortDay(s.done_on)}</span>
                : s.due_on && <span className="muted"> due {formatShortDay(s.due_on)}</span>}
              {!s.done_on && isOverdue(s, today) && <> <span className="badge badge-oxblood">Overdue</span></>}
            </span>
            <span className="step-actions">
              <Button variant="secondary" size="sm" icon={Pencil} aria-label={`Edit ${s.title}`} onClick={() => setEditing(s.id)} />
              <Button variant="secondary" size="sm" icon={Trash2} aria-label={`Delete ${s.title}`}
                onClick={() => del({ url: `${base}/${s.id}`, label: s.title, onChange })} />
            </span>
          </li>
        )))}
      </ul>
      {editing === 'new'
        ? <StepForm onSave={save('new')} onCancel={() => setEditing(null)} />
        : <p><Button variant="secondary" onClick={() => setEditing('new')}>Add a step</Button></p>}
    </>
  );
}
