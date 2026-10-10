import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextArea, Select, Checkbox } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { RULE_KINDS, WEIGHTS, PLANETS, ELEMENTS, valueOptions, ruleTitle, weightText, slugOf } from '../../lib/sky.js';

const MAX_TEXT = 300;
const blank = { kind: 'phase_group', value: 'waxing', text: '', weight: '2', recipe_types: [], planets: [], elements: [] };
const toggle = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

function CheckGroup({ legend, options, selected, onToggle }) {
  return (
    <fieldset className="check-group">
      <legend>{legend}</legend>
      <div className="check-group-options">
        {options.map(o => <Checkbox key={o.value} label={o.label} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />)}
      </div>
    </fieldset>
  );
}

function RuleForm({ rule, types, typesError, onRetryTypes, open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => (rule ? {
    kind: rule.kind, value: rule.value, text: rule.text, weight: String(rule.weight),
    recipe_types: rule.recipe_types, planets: rule.planets, elements: rule.elements,
  } : blank));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };
  const setKind = kind => {
    setForm(f => ({ ...f, kind, value: valueOptions(kind)[0].value }));
    setErrors(e => ({ ...e, kind: undefined, value: undefined }));
  };

  // Her types by slug, plus any slug the rule already names that no live type has, so it can still be unticked.
  const typeOptions = types.map(t => ({ value: slugOf(t), label: t.name }));
  for (const slug of form.recipe_types) if (!typeOptions.some(o => o.value === slug)) typeOptions.push({ value: slug, label: slug });

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setFormError('');
    const text = form.text.trim();
    if (!text) { setErrors({ text: 'Write what the tradition says.' }); return; }
    const body = {
      kind: form.kind, value: form.value, text, weight: Number(form.weight),
      recipe_types: form.recipe_types, planets: form.planets, elements: form.elements,
    };
    setSaving(true);
    try {
      if (rule) await api.patch(`/api/timing-rules/${rule.id}`, body); else await api.post('/api/timing-rules', body);
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
    <Dialog open={open} onClose={onClose} title={rule ? 'Edit rule' : 'Add a timing rule'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="timing-rule-form" disabled={saving}>Save</Button></>}>
      <form id="timing-rule-form" onSubmit={save} noValidate>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <Field label="Kind" error={errors.kind}>
          <Select data-autofocus value={form.kind} onChange={e => setKind(e.target.value)} options={RULE_KINDS.map(k => ({ value: k.value, label: k.label }))} />
        </Field>
        <Field label="Value" error={errors.value}>
          <Select value={form.value} onChange={e => set('value', e.target.value)} options={valueOptions(form.kind)} />
        </Field>
        <Field label="Text" hint={`${form.text.length} of ${MAX_TEXT}`} error={errors.text}>
          <TextArea rows={3} maxLength={MAX_TEXT} value={form.text} onChange={e => set('text', e.target.value)} />
        </Field>
        <Field label="Weight" error={errors.weight}>
          <Select value={form.weight} onChange={e => set('weight', e.target.value)} options={WEIGHTS} />
        </Field>
        <CheckGroup legend="Favours these recipe types" options={typeOptions} selected={form.recipe_types} onToggle={v => set('recipe_types', toggle(form.recipe_types, v))} />
        {typesError && (
          <p role="alert" className="field-error">
            Couldn't load your recipe types. <Button type="button" variant="secondary" size="sm" onClick={onRetryTypes}>Try again</Button>
          </p>
        )}
        {errors.recipe_types && <small className="field-error" role="alert">{errors.recipe_types}</small>}
        <CheckGroup legend="Favours herbs ruled by" options={PLANETS.map(p => ({ value: p, label: p }))} selected={form.planets} onToggle={v => set('planets', toggle(form.planets, v))} />
        {errors.planets && <small className="field-error" role="alert">{errors.planets}</small>}
        <CheckGroup legend="Favours herbs of the element" options={ELEMENTS.map(p => ({ value: p, label: p }))} selected={form.elements} onToggle={v => set('elements', toggle(form.elements, v))} />
        {errors.elements && <small className="field-error" role="alert">{errors.elements}</small>}
      </form>
    </Dialog>
  );
}

export function TimingRules() {
  const toast = useToast();
  const deleteWithUndo = useDeleteWithUndo();
  const rules = useApi('/api/timing-rules');
  const typesApi = useApi('/api/recipe-types');
  const types = typesApi.data ?? [];
  const [editing, setEditing] = useState(null); // 'new' or a rule; kept after closing so the dialog can close cleanly
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Which form instance is open right now; a save that started in an earlier one must not close a newer one.
  const activeForm = useRef(null);
  const openForm = r => {
    const key = formKey + 1;
    activeForm.current = key;
    setEditing(r); setFormKey(key); setFormOpen(true);
  };
  const closeForm = key => { if (activeForm.current === key) { activeForm.current = null; setFormOpen(false); } };
  const list = rules.data || [];
  const [moving, setMoving] = useState(false);

  const typeName = slug => types.find(t => slugOf(t) === slug)?.name ?? slug;
  const favours = r => [
    r.recipe_types.length > 0 && `Recipes: ${r.recipe_types.map(typeName).join(', ')}`,
    r.planets.length > 0 && `Planets: ${r.planets.join(', ')}`,
    r.elements.length > 0 && `Elements: ${r.elements.join(', ')}`,
  ].filter(Boolean).join(' · ');

  const [announcement, setAnnouncement] = useState('');
  const pending = useRef(null);
  // While a move is in flight this holds the list she moved from; moves stay blocked until a different list arrives.
  const awaiting = useRef(undefined);
  const listRef = useRef(null);

  // Once the reordered list has loaded, put focus back on the button she just used (or the other one at an end) and say where the rule went.
  useEffect(() => {
    if (awaiting.current === undefined) return;
    if (rules.data === awaiting.current && !rules.error) return;
    awaiting.current = undefined;
    setMoving(false);
    const p = pending.current;
    if (!p || !rules.data) return;
    pending.current = null;
    const index = rules.data.findIndex(r => r.id === p.id);
    if (index < 0) return;
    const atEnd = p.dir === 'up' ? index === 0 : index === rules.data.length - 1;
    const dir = atEnd ? (p.dir === 'up' ? 'down' : 'up') : p.dir;
    listRef.current?.querySelector(`[data-move="${p.id}-${dir}"]`)?.focus();
    setAnnouncement(`Moved ${p.title} to position ${index + 1}.`);
  }, [rules.data, rules.error]);

  const shift = async (i, by) => {
    if (moving) return;
    const ids = list.map(r => r.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    setMoving(true);
    setAnnouncement('');
    pending.current = { id: list[i].id, dir: by < 0 ? 'up' : 'down', title: ruleTitle(list[i]) };
    try {
      await api.put('/api/timing-rules/order', { ids });
    } catch (err) {
      pending.current = null;
      toast.show({ message: err.message, duration: 6000 });
    }
    awaiting.current = rules.data;
    rules.reload();
  };

  const header = <PageHeader title="Timing rules" subtitle="Folk tradition, in your own words" actions={<Link to="/settings">Back to settings</Link>} />;
  if (rules.error) {
    return (<>{header}<p role="alert">{rules.error.message}</p><Button onClick={rules.reload}>Try again</Button></>);
  }
  if (!rules.data) return <>{header}<p>Opening the timing rules…</p></>;

  return (
    <>
      {header}
      <p><Button onClick={() => openForm('new')}>Add a rule</Button></p>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
      <ParchmentCard title="Your rules" subtitle="the strongest matches show on Today">
        {list.length === 0 && <p className="muted">No rules yet. Add one to get folk timing on Today.</p>}
        <ul className="type-list" ref={listRef}>
          {list.map((r, i) => (
            <li key={r.id} className="type-row">
              <div className="type-main">
                <strong>{ruleTitle(r)}</strong> <span className="badge badge-brass">{weightText(r.weight)}</span>
                <p>{r.text}</p>
                {favours(r) && <p className="muted">{favours(r)}</p>}
              </div>
              <div className="type-actions">
                <Button variant="secondary" size="sm" icon={Pencil} aria-label={`Edit ${ruleTitle(r)}`} onClick={() => openForm(r)} />
                <Button variant="secondary" size="sm" icon={ArrowUp} aria-label={`Move ${ruleTitle(r)} up`} data-move={`${r.id}-up`}
                  aria-disabled={moving || i === 0 ? 'true' : undefined} onClick={() => { if (!moving && i > 0) shift(i, -1); }} />
                <Button variant="secondary" size="sm" icon={ArrowDown} aria-label={`Move ${ruleTitle(r)} down`} data-move={`${r.id}-down`}
                  aria-disabled={moving || i === list.length - 1 ? 'true' : undefined} onClick={() => { if (!moving && i < list.length - 1) shift(i, 1); }} />
                <Button variant="secondary" size="sm" icon={Trash2} aria-label={`Delete ${ruleTitle(r)}`}
                  onClick={() => deleteWithUndo({ url: `/api/timing-rules/${r.id}`, label: ruleTitle(r), onChange: rules.reload })} />
              </div>
            </li>
          ))}
        </ul>
      </ParchmentCard>
      {editing && <RuleForm key={formKey} rule={editing === 'new' ? null : editing} types={types} typesError={Boolean(typesApi.error)} onRetryTypes={typesApi.reload}
        open={formOpen} onClose={() => closeForm(formKey)} onSaved={rules.reload} />}
    </>
  );
}
