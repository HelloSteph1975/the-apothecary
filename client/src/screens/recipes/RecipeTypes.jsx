import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, NumberInput, TextArea, Select, Checkbox } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { RECIPE_ICONS, TypeIcon, daysText, shelfText } from '../../lib/recipes.jsx';

const orNull = v => (v.trim() === '' ? null : v.trim());
const dayOrNull = v => (v === '' || v == null ? null : Number(v));
const blank = { name: '', description: '', wait_days: '', shelf_life_days: '', label_caution: '', is_topical: false, icon: 'sprout' };

function TypeForm({ type, open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => (type ? {
    name: type.name, description: type.description ?? '', wait_days: type.wait_days ?? '', shelf_life_days: type.shelf_life_days ?? '',
    label_caution: type.label_caution ?? '', is_topical: Boolean(type.is_topical), icon: type.icon || 'sprout',
  } : blank));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setFormError('');
    if (!form.name.trim()) { setErrors({ name: 'Give this type a name.' }); return; }
    const body = {
      name: form.name.trim(), description: orNull(form.description), wait_days: dayOrNull(form.wait_days),
      shelf_life_days: dayOrNull(form.shelf_life_days), label_caution: orNull(form.label_caution), is_topical: form.is_topical, icon: form.icon,
    };
    setSaving(true);
    try {
      if (type) await api.patch(`/api/recipe-types/${type.id}`, body); else await api.post('/api/recipe-types', body);
      onSaved();
      onClose();
    } catch (ex) {
      const details = ex.details ?? {};
      setErrors(details);
      if (Object.keys(details).length === 0) setFormError(ex.message);
      else toast.show({ message: ex.message, duration: 6000 });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={type ? `Edit ${type.name}` : 'Add a recipe type'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="recipe-type-form" disabled={saving}>Save</Button></>}>
      <form id="recipe-type-form" onSubmit={save} noValidate>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <Field label="Name" error={errors.name}><TextInput data-autofocus value={form.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Description" error={errors.description}><TextArea rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
        <Field label="Wait in days" hint="How long it sits before it is ready. Leave empty for none." error={errors.wait_days}>
          <NumberInput min="0" step="1" value={form.wait_days} onChange={e => set('wait_days', e.target.value)} />
        </Field>
        <Field label="Shelf life in days" hint="How long it keeps once made." error={errors.shelf_life_days}>
          <NumberInput min="0" step="1" value={form.shelf_life_days} onChange={e => set('shelf_life_days', e.target.value)} />
        </Field>
        <Field label="Label caution" error={errors.label_caution}><TextInput value={form.label_caution} onChange={e => set('label_caution', e.target.value)} /></Field>
        <p><Checkbox label="For the skin (shows a patch-test reminder)" checked={form.is_topical} onChange={e => set('is_topical', e.target.checked)} /></p>
        <div role="radiogroup" aria-labelledby="icon-picker-label" aria-describedby={errors.icon ? 'icon-picker-error' : undefined} className="icon-picker">
          <span id="icon-picker-label" className="icon-picker-label">Icon</span>
          <div className="icon-picker-options">
            {RECIPE_ICONS.map(o => (
              <label key={o.value} className="icon-option">
                <input type="radio" name="recipe-type-icon" value={o.value} checked={form.icon === o.value} onChange={() => set('icon', o.value)} />
                <TypeIcon icon={o.value} size={20} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
        {errors.icon && <small id="icon-picker-error" className="field-error" role="alert">{errors.icon}</small>}
      </form>
    </Dialog>
  );
}

export function RecipeTypes() {
  const toast = useToast();
  const deleteWithUndo = useDeleteWithUndo();
  const types = useApi('/api/recipe-types');
  const [editing, setEditing] = useState(null); // 'new' or a type; kept after closing so the dialog can close cleanly
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const openForm = t => { setEditing(t); setFormKey(k => k + 1); setFormOpen(true); };
  const [moving, setMoving] = useState(null); // { type, count, to }
  const panel = useRef();
  const movingId = moving?.type.id;
  useEffect(() => { if (movingId) panel.current?.querySelector('select')?.focus(); }, [movingId]);

  const fail = err => toast.show({ message: err.message, duration: 6000 });
  const list = types.data || [];

  const shift = async (i, by) => {
    const ids = list.map(t => t.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    try { await api.put('/api/recipe-types/order', { ids }); types.reload(); } catch (err) { fail(err); }
  };
  const askMove = (type, count) => {
    const other = list.find(x => x.id !== type.id);
    setMoving({ type, count, to: other ? String(other.id) : '' });
  };
  const remove = async type => {
    if (type.recipe_count > 0) { askMove(type, type.recipe_count); return; }
    await deleteWithUndo({ url: `/api/recipe-types/${type.id}`, label: type.name, onChange: types.reload });
  };
  const confirmMove = async () => {
    const { type, to } = moving;
    try {
      const res = await api.del(`/api/recipe-types/${type.id}?move_to=${to}`);
      setMoving(null);
      types.reload();
      toast.show({
        message: `Deleted ${type.name}`,
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try { await api.post(res.restore); types.reload(); toast.show({ message: `Brought back ${type.name}` }); } catch (err) { fail(err); }
          },
        },
      });
    } catch (err) { fail(err); }
  };

  const header = <PageHeader title="Recipe types" subtitle="The kinds of things you make" actions={<Link to="/recipes">Back to the recipe book</Link>} />;
  if (types.error) {
    return (<>{header}<p role="alert">{types.error.message}</p><Button onClick={types.reload}>Try again</Button></>);
  }
  if (!types.data) return <>{header}<p>Opening the recipe types…</p></>;

  return (
    <>
      {header}
      <p><Button onClick={() => openForm('new')}>Add a type</Button></p>
      <ParchmentCard title="Your types">
        <ul className="type-list">
          {list.map((t, i) => (
            <li key={t.id} className="type-row">
              <span className="type-icon"><TypeIcon icon={t.icon} size={24} /></span>
              <div className="type-main">
                <strong>{t.name}</strong>
                {Boolean(t.is_topical) && <> <span className="badge badge-brass">For the skin</span></>}
                {t.description && <p className="muted">{t.description}</p>}
                <p className="muted">
                  {[t.wait_days != null && `Wait: ${daysText(t.wait_days)}`, t.shelf_life_days != null && `Keeps: ${shelfText(t.shelf_life_days)}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="type-actions">
                <Button variant="secondary" size="sm" icon={Pencil} aria-label={`Edit ${t.name}`} onClick={() => openForm(t)} />
                <Button variant="secondary" size="sm" icon={ArrowUp} aria-label={`Move ${t.name} up`} disabled={i === 0} onClick={() => shift(i, -1)} />
                <Button variant="secondary" size="sm" icon={ArrowDown} aria-label={`Move ${t.name} down`} disabled={i === list.length - 1} onClick={() => shift(i, 1)} />
                <Button variant="secondary" size="sm" icon={Trash2} aria-label={`Delete ${t.name}`} onClick={() => remove(t)} />
              </div>
            </li>
          ))}
        </ul>
      </ParchmentCard>
      {editing && <TypeForm key={formKey} type={editing === 'new' ? null : editing} open={formOpen} onClose={() => setFormOpen(false)} onSaved={types.reload} />}
      <Dialog open={Boolean(moving)} onClose={() => setMoving(null)} title={moving ? `Delete ${moving.type.name}` : ''}
        footer={moving && <><Button variant="secondary" onClick={() => setMoving(null)}>Cancel</Button><Button onClick={confirmMove} disabled={!moving.to}>Move and delete</Button></>}>
        {moving && (
          <div ref={panel}>
            {!moving.to && <p className="muted">Add another type first.</p>}
            <Field label={`Move its ${moving.count} ${moving.count === 1 ? 'recipe' : 'recipes'} to`}>
              <Select value={moving.to} onChange={e => setMoving(m => ({ ...m, to: e.target.value }))}
                options={list.filter(t => t.id !== moving.type.id).map(t => ({ value: String(t.id), label: t.name }))} />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
