import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, TextArea, DateInput, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { Dialog } from '../../components/Dialog.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { formatAmount } from '../../lib/cabinet.js';
import { todayString } from '../../lib/today.js';
import { ScaleControl } from '../recipes/ScaleControl.jsx';
import { DrawLines, linesFromPlan, linesBody } from './DrawLines.jsx';

const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const FIELDS = ['name', 'intention', 'method', 'base', 'label_notes'];
const EMPTY = { name: '', intention: '', method: '', base: '', label_notes: '', notes: '' };

const inputKey = (...parts) => JSON.stringify(parts);

let stepKey = 1;
const newStep = (st = {}) => ({ key: stepKey++, title: s(st.title), due_on: s(st.due_on) });

export function NewBatch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recipes = useApi('/api/recipes');
  const [recipeId, setRecipeId] = useState(params.get('recipe') || '');
  const [scale, setScale] = useState(params.get('scale') || '');
  const [yieldValue, setYield] = useState(params.get('yield') || '');
  const [startDate, setStartDate] = useState(todayString());
  const [dateInput, setDateInput] = useState(startDate);
  const [plan, setPlan] = useState(null);
  const [planKey, setPlanKey] = useState(null); // the inputs the shown plan was made for
  const [planError, setPlanError] = useState(null);
  const [scaleError, setScaleError] = useState(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [lines, setLines] = useState([]);
  const [freeLines, setFreeLines] = useState([]);
  const [steps, setSteps] = useState([]);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [short, setShort] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const edited = useRef(new Set());
  const free = recipeId === '';
  const items = useApi(free ? `/api/items?today=${todayString()}` : null);
  const markSaved = useLeaveGuard(touched);

  // A start date typed by hand waits a moment before it asks for a new plan.
  useEffect(() => {
    if (dateInput === startDate || dateInput === '') return undefined;
    const t = setTimeout(() => setStartDate(dateInput), 300);
    return () => clearTimeout(t);
  }, [dateInput, startDate]);

  // A recipe link that is not in the book falls back to free-form.
  useEffect(() => {
    if (recipes.data && recipeId && !recipes.data.some(r => String(r.id) === recipeId)) setRecipeId('');
  }, [recipes.data, recipeId]);

  useEffect(() => {
    if (!recipeId) { setPlan(null); setPlanError(null); setScaleError(null); return undefined; }
    let live = true;
    const key = inputKey(recipeId, scale, yieldValue, startDate);
    const body = { recipe_id: Number(recipeId), start_date: startDate };
    if (scale) body.scale = Number(scale);
    else if (yieldValue) body.yield = Number(yieldValue);
    api.post('/api/batches/plan', body).then(
      p => {
        if (!live) return;
        setPlan(p);
        setPlanKey(key);
        setPlanError(null);
        setScaleError(null);
        setLines(linesFromPlan(p));
        setSteps(p.steps.map(newStep));
        setErrors({});
        setForm(f => {
          const next = { ...f };
          const fill = { name: p.name, ...p.prefill };
          for (const k of FIELDS) if (!edited.current.has(k)) next[k] = s(fill[k]);
          return next;
        });
      },
      err => {
        if (!live) return;
        if (err.status === 400 && (err.details?.scale || err.details?.yield)) setScaleError(err.details);
        else setPlanError(err);
      },
    );
    return () => { live = false; };
  }, [recipeId, scale, yieldValue, startDate, tick]);

  const chooseRecipe = value => {
    edited.current = new Set();
    setForm(f => ({ ...EMPTY, notes: f.notes }));
    setRecipeId(value);
    setScale('');
    setYield('');
    setScaleError(null);
    setPlan(null);
    setPlanKey(null);
    setLines([]);
    setSteps([]);
  };
  const setField = (k, v) => {
    edited.current.add(k);
    setTouched(true);
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };
  const changeLines = next => {
    setTouched(true);
    (free ? setFreeLines : setLines)(next);
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'lines' && !k.startsWith('lines.'))));
  };
  const changeSteps = next => {
    setTouched(true);
    setSteps(next);
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'steps' && !k.startsWith('steps.'))));
  };
  const updateStep = (i, patch) => changeSteps(steps.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  async function save(e, confirmShort = false) {
    e?.preventDefault();
    if (savingRef.current || !canStart) return;
    savingRef.current = true;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      recipe_id: free ? null : Number(recipeId),
      start_date: dateInput,
      intention: orNull(form.intention),
      method: orNull(form.method),
      base: orNull(form.base),
      label_notes: orNull(form.label_notes),
      notes: orNull(form.notes),
      lines: linesBody(free ? freeLines : lines, free),
      steps: steps.filter(x => x.title.trim() !== '' || x.due_on !== '').map(x => ({ title: x.title.trim(), due_on: x.due_on || null })),
    };
    if (!free && plan) body.factor = plan.factor;
    if (confirmShort) body.confirm_short = true;
    try {
      const batch = await api.post('/api/batches', body);
      markSaved();
      toast.show({ message: 'Batch started' });
      navigate(`/batches/${batch.id}`);
    } catch (ex) {
      if (ex.status === 409 && Array.isArray(ex.details?.short)) setShort(ex.details.short);
      else {
        setErrors(ex.details ?? {});
        toast.show({ message: ex.message, duration: 6000 });
      }
      savingRef.current = false;
      setSaving(false);
    }
  }

  // A recipe batch may only be saved from the plan made for exactly what is on screen now.
  const planCurrent = free || (plan != null && planKey === inputKey(recipeId, scale, yieldValue, dateInput) && !scaleError);
  const dateMissing = dateInput === '';
  const canStart = planCurrent && !dateMissing;

  const header = <PageHeader title="Start a batch" subtitle="Pick a recipe, check the jars, and begin" />;
  const loadError = recipes.error || items.error || planError;
  if (loadError) {
    const retry = () => {
      if (recipes.error) recipes.reload();
      if (items.error) items.reload();
      if (planError) { setPlanError(null); setTick(t => t + 1); }
    };
    return (
      <>{header}
        <p role="alert">{loadError.message}</p>
        <Button onClick={retry}>Try again</Button>
      </>
    );
  }
  if (!recipes.data) return <>{header}<p>Opening the journal…</p></>;

  const picked = recipes.data.find(r => String(r.id) === recipeId);
  const recipeInfo = { factor: plan?.factor ?? 1, yield_amount: picked?.yield_amount, yield_unit: picked?.yield_unit, scaled_yield_amount: null };
  const waiting = !free && !plan && !scaleError;
  const blocked = !free && !plan && Boolean(scaleError);

  return (
    <>
      {header}
      <form onSubmit={save} noValidate>
        <ParchmentCard title="Start from">
          <Field label="Recipe" error={errors.recipe_id}>
            <Select value={recipeId} onChange={e => chooseRecipe(e.target.value)} placeholder="No recipe (free-form)"
              options={recipes.data.map(r => ({ value: String(r.id), label: r.name }))} />
          </Field>
          <Field label="Start date" error={dateMissing ? 'Pick a start date' : errors.start_date}>
            <DateInput value={dateInput} onChange={e => setDateInput(e.target.value)} />
          </Field>
        </ParchmentCard>
        {!free && (
          <ScaleControl key={recipeId} recipe={recipeInfo} scaleParam={scale} yieldParam={yieldValue} error={scaleError}
            setScale={(sc, y) => { setScale(sc); setYield(y); }} />
        )}
        {waiting ? <p role="status">Working out the jars…</p> : (
          <>
            {!blocked && (<>
            <ParchmentCard title="Ingredients and jars" subtitle={free ? undefined : 'Each jar is drawn down when you start.'}>
              <DrawLines lines={free ? freeLines : lines} onChange={changeLines} free={free} items={items.data ?? []} errors={errors} />
            </ParchmentCard>
            <ParchmentCard title="Steps for later">
              {steps.length === 0 && <p className="muted">No steps yet.</p>}
              {steps.map((x, i) => {
                const n = i + 1;
                return (
                  <fieldset key={x.key} className="source-row">
                    <legend>{`Step ${n}`}</legend>
                    <Field label={`Step ${n} title`} error={errors[`steps.${i}.title`]}>
                      <TextInput value={x.title} onChange={e => updateStep(i, { title: e.target.value })} />
                    </Field>
                    <Field label={`Step ${n} due date`} error={errors[`steps.${i}.due_on`]}>
                      <DateInput value={x.due_on} onChange={e => updateStep(i, { due_on: e.target.value })} />
                    </Field>
                    <p className="page-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => changeSteps(steps.filter((_, k) => k !== i))}>{`Remove step ${n}`}</button>
                    </p>
                  </fieldset>
                );
              })}
              {errors.steps && <p className="field-error" role="alert">{errors.steps}</p>}
              <p><button type="button" className="btn btn-secondary" onClick={() => changeSteps([...steps, newStep()])}>Add a step</button></p>
            </ParchmentCard>
            <ParchmentCard title="Journal">
              <Field label="Name" error={errors.name}>
                <TextInput required aria-required="true" value={form.name} onChange={e => setField('name', e.target.value)} />
              </Field>
              <Field label="Why I made it" error={errors.intention}>
                <TextInput value={form.intention} onChange={e => setField('intention', e.target.value)} />
              </Field>
              <Field label="How I'm preparing it" error={errors.method}>
                <TextArea rows={5} value={form.method} onChange={e => setField('method', e.target.value)} />
              </Field>
              <Field label="Base" error={errors.base}>
                <TextInput value={form.base} onChange={e => setField('base', e.target.value)} />
              </Field>
              <Field label="Label and shelf-life notes" error={errors.label_notes}>
                <TextArea value={form.label_notes} onChange={e => setField('label_notes', e.target.value)} />
              </Field>
              <Field label="Notes" error={errors.notes}>
                <TextArea value={form.notes} onChange={e => setField('notes', e.target.value)} />
              </Field>
            </ParchmentCard>
            </>)}
            <p className="page-actions">
              <WaxSeal type="submit" disabled={saving || blocked || !canStart}>Start batch</WaxSeal>
              {!free && !canStart && !blocked && !dateMissing && !scaleError && <span role="status" className="muted">Updating the jars…</span>}
              <Link to="/batches">Cancel</Link>
            </p>
          </>
        )}
      </form>
      <Dialog open={short != null} onClose={() => setShort(null)} title="Some jars are running short"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setShort(null)}>Go back</Button>
            <Button onClick={() => { setShort(null); save(null, true); }}>Use what's there (set to 0)</Button>
          </>
        )}>
        <p>These jars hold less than you are drawing. If you go on, each one is set to 0.</p>
        <ul>
          {(short ?? []).map(x => <li key={`${x.line}-${x.item_id}`}>{`${x.name}: has ${formatAmount(x.has, x.unit)}, drawing ${formatAmount(x.wants, x.unit)}`}</li>)}
        </ul>
      </Dialog>
    </>
  );
}
