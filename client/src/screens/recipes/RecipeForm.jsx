import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, TextArea, NumberInput, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { RECIPE_UNITS, daysText, shelfText } from '../../lib/recipes.jsx';
import { IngredientsEditor, newIngredient } from './IngredientsEditor.jsx';

const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const numOrNull = v => (v.trim() === '' ? null : Number(v));
const TEXT_KEYS = ['name', 'yield_amount', 'yield_unit', 'wait_days', 'shelf_life_days', 'intention', 'timing_notes', 'steps', 'notes'];
const plain = list => list.map(({ key, ...rest }) => rest);

function fromRecipe(r, { typeId, herb, liveTypes }) {
  const own = s(r.type_id);
  const form = { type_id: own !== '' && liveTypes.some(t => String(t.id) === own) ? own : s(typeId) };
  for (const k of TEXT_KEYS) form[k] = s(r[k]);
  const rows = Array.isArray(r.ingredients) ? r.ingredients.map(i => newIngredient(i)) : [];
  if (herb && rows.length === 0) rows.push(newIngredient({ herb_id: herb.id, name: herb.common_name }));
  return { form, rows };
}

export function RecipeForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recipe = useApi(editing ? `/api/recipes/${id}` : null);
  const types = useApi('/api/recipe-types');
  const herbs = useApi('/api/herbs');
  const [form, setForm] = useState(null);
  const [rows, setRows] = useState([]);
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});
  const [typeGone, setTypeGone] = useState(false);

  const ready = types.data && herbs.data && (!editing || recipe.data);
  useEffect(() => {
    if (form || !ready) return;
    const wantedType = params.get('type');
    const typeId = !editing && types.data.some(t => String(t.id) === wantedType) ? wantedType : '';
    const wantedHerb = params.get('herb');
    const herb = !editing ? herbs.data.find(h => String(h.id) === wantedHerb) : null;
    const start = fromRecipe(editing ? recipe.data : {}, { typeId, herb, liveTypes: types.data });
    setTypeGone(editing && recipe.data.type_id != null && start.form.type_id === '');
    setForm(start.form);
    setRows(start.rows);
    setInitial(JSON.stringify([start.form, plain(start.rows)]));
  }, [form, ready, editing, recipe.data, types.data, herbs.data, params]);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dirty = Boolean(form) && JSON.stringify([form, plain(rows)]) !== initial;
  const markSaved = useLeaveGuard(dirty);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };
  // Ingredient errors are keyed by row index, so any change to the list makes them stale.
  const changeRows = next => {
    setRows(next);
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'ingredients' && !k.startsWith('ingredients.'))));
  };

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      type_id: form.type_id === '' ? null : Number(form.type_id),
      yield_amount: numOrNull(form.yield_amount),
      yield_unit: orNull(form.yield_unit),
      wait_days: numOrNull(form.wait_days),
      shelf_life_days: numOrNull(form.shelf_life_days),
      intention: orNull(form.intention),
      timing_notes: orNull(form.timing_notes),
      steps: orNull(form.steps),
      notes: orNull(form.notes),
      ingredients: rows.map(x => ({
        herb_id: x.herb_id === '' ? null : Number(x.herb_id),
        herb_gone: x.deletedHerb && x.herb_id === '',
        name: x.name.trim(),
        amount: numOrNull(x.amount),
        unit: orNull(x.unit),
        form: orNull(x.form),
        plant_part: orNull(x.plant_part),
        note: orNull(x.note),
      })),
    };
    try {
      const result = editing ? await api.patch(`/api/recipes/${id}`, body) : await api.post('/api/recipes', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/recipes/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
      savingRef.current = false;
      setSaving(false);
    }
  }

  const heading = editing ? 'Edit recipe' : 'Add a recipe';
  const loadError = (editing && recipe.error) || types.error || herbs.error;
  if (loadError) {
    const retry = () => { if (recipe.error) recipe.reload(); if (types.error) types.reload(); if (herbs.error) herbs.reload(); };
    return (
      <>
        <PageHeader title={heading} />
        <p role="alert">{loadError.message}</p>
        <Button onClick={retry}>Try again</Button>
      </>
    );
  }
  if (!form) return <PageHeader title={heading} />;

  const type = types.data.find(t => String(t.id) === form.type_id);
  const waitHint = !type ? undefined : type.wait_days == null ? 'Leave blank if there is no wait.'
    : type.wait_days === 0 ? "Leave blank to use the type's default: ready when made." : `Leave blank to use the type's ${daysText(type.wait_days)}`;
  const shelfHint = !type ? undefined : type.shelf_life_days == null ? 'Leave blank if you are not sure.'
    : `Leave blank to use the type's ${shelfText(type.shelf_life_days)}`;
  const typeOptions = types.data.map(t => ({ value: String(t.id), label: t.name }));
  const unitOptions = form.yield_unit && !RECIPE_UNITS.some(u => u.value === form.yield_unit)
    ? [...RECIPE_UNITS, { value: form.yield_unit, label: form.yield_unit }] : RECIPE_UNITS;

  return (
    <>
      <PageHeader title={editing ? `Edit ${recipe.data.name}` : heading} />
      <form onSubmit={save} noValidate>
        <ParchmentCard title="The basics">
          <Field label="Name (required)" error={errors.name}>
            <TextInput required aria-required="true" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Type (required)" error={errors.type_id}
            hint={typeGone && form.type_id === '' ? 'The type this recipe used was deleted. Pick a new one.' : undefined}>
            <Select required aria-required="true" value={form.type_id} onChange={e => set('type_id', e.target.value)} placeholder="Pick a type" options={typeOptions} />
          </Field>
          <Field label="Yield amount" error={errors.yield_amount}>
            <NumberInput min="0" value={form.yield_amount} onChange={e => set('yield_amount', e.target.value)} />
          </Field>
          <Field label="Yield unit" error={errors.yield_unit}>
            <Select value={form.yield_unit} onChange={e => set('yield_unit', e.target.value)} placeholder="No unit" options={unitOptions} />
          </Field>
          <Field label="Wait in days" hint={waitHint} error={errors.wait_days}>
            <NumberInput min="0" step="1" value={form.wait_days} onChange={e => set('wait_days', e.target.value)} />
          </Field>
          <Field label="Shelf life in days" hint={shelfHint} error={errors.shelf_life_days}>
            <NumberInput min="0" step="1" value={form.shelf_life_days} onChange={e => set('shelf_life_days', e.target.value)} />
          </Field>
        </ParchmentCard>
        <ParchmentCard title="Ingredients">
          <IngredientsEditor ingredients={rows} onChange={changeRows} herbs={herbs.data} errors={errors} />
        </ParchmentCard>
        <ParchmentCard title="Method">
          <Field label="Intention" error={errors.intention}>
            <TextInput value={form.intention} onChange={e => set('intention', e.target.value)} />
          </Field>
          <Field label="Best timing" hint="Your own notes on when to make it." error={errors.timing_notes}>
            <TextArea value={form.timing_notes} onChange={e => set('timing_notes', e.target.value)} />
          </Field>
          <Field label="Steps" hint="One step per line" error={errors.steps}>
            <TextArea rows={6} value={form.steps} onChange={e => set('steps', e.target.value)} />
          </Field>
          <Field label="Notes" error={errors.notes}>
            <TextArea value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </ParchmentCard>
        <p className="page-actions">
          <WaxSeal type="submit" disabled={saving}>Save</WaxSeal>
          <Link to={editing ? `/recipes/${id}` : '/recipes'}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
