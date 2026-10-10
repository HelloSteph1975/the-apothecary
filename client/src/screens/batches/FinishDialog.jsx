import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, NumberInput, DateInput, Select, Checkbox } from '../../components/Field.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { UNITS } from '../../lib/cabinet.js';
import { RECIPE_UNITS } from '../../lib/recipes.jsx';
import { todayString } from '../../lib/today.js';

const s = v => (v == null ? '' : String(v));
const isCabinetUnit = u => UNITS.some(x => x.value === u);
const num = v => (v === '' || v == null ? null : Number(v));

// Stays mounted and toggles `open`, like the other dialogs. Reopening starts from fresh defaults.
export function FinishDialog({ batch, open, onClose, onFinished }) {
  const recipe = useApi(batch.recipe_id ? `/api/recipes/${batch.recipe_id}?scale=${batch.factor ?? 1}` : null);
  const sections = useApi('/api/sections');
  const [form, setForm] = useState({ finished_on: '', yield_amount: '', yield_unit: '', expires_on: '' });
  const [addJar, setAddJar] = useState(true);
  const [jar, setJar] = useState({ section_id: '', name: '', amount: null, unit: null, storage_spot: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const list = sections.data ?? [];
  const firstSupply = list.find(x => x.kind === 'supply') ?? list[0];
  const planned = recipe.data;

  // Fresh defaults each time it opens, from the recipe's scaled yield.
  useEffect(() => {
    if (!open) return;
    setForm({ finished_on: todayString(), yield_amount: s(planned?.scaled_yield_amount), yield_unit: planned?.yield_unit ?? '', expires_on: '' });
    setAddJar(true);
    setJar({ section_id: '', name: batch.name, amount: null, unit: null, storage_spot: '' });
    setErrors({});
    setFormError('');
    // Only opening resets the form; a late recipe load fills in through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The yield can arrive after the dialog opens; fill it in only if she has not touched it.
  useEffect(() => {
    if (!open || !planned) return;
    setForm(f => (f.yield_amount === '' && f.yield_unit === ''
      ? { ...f, yield_amount: s(planned.scaled_yield_amount), yield_unit: planned.yield_unit ?? '' } : f));
  }, [open, planned]);

  const sectionId = jar.section_id || (firstSupply ? String(firstSupply.id) : '');
  const jarAmount = jar.amount ?? form.yield_amount;
  const jarUnit = jar.unit ?? (isCabinetUnit(form.yield_unit) ? form.yield_unit : '');
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };
  const setJ = (k, v) => { setJar(j => ({ ...j, [k]: v })); setErrors(e => ({ ...e, [`add_to_cabinet.${k}`]: undefined })); };

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    setFormError('');
    const body = { finished_on: form.finished_on, yield_amount: num(form.yield_amount), yield_unit: form.yield_unit || null };
    if (form.expires_on) body.expires_on = form.expires_on;
    if (addJar) {
      body.add_to_cabinet = { section_id: num(sectionId), name: jar.name.trim(), amount: num(jarAmount), unit: jarUnit || null };
      if (jar.storage_spot.trim()) body.add_to_cabinet.storage_spot = jar.storage_spot.trim();
    }
    savingRef.current = true;
    setSaving(true);
    try {
      onFinished(await api.post(`/api/batches/${batch.id}/finish`, body));
    } catch (ex) {
      setErrors(ex.details ?? {});
      setFormError(ex.message);
    } finally { savingRef.current = false; setSaving(false); }
  }

  const err = k => errors[`add_to_cabinet.${k}`];
  const yieldUnits = form.yield_unit && !RECIPE_UNITS.some(u => u.value === form.yield_unit)
    ? [...RECIPE_UNITS, { value: form.yield_unit, label: form.yield_unit }] : RECIPE_UNITS;

  return (
    <Dialog open={open} onClose={onClose} title="Finish this batch"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="finish-batch-form" disabled={saving}>Finish</Button></>}>
      <form id="finish-batch-form" onSubmit={save} noValidate>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <Field label="Finished on" error={errors.finished_on}>
          <DateInput data-autofocus value={form.finished_on} onChange={e => setF('finished_on', e.target.value)} />
        </Field>
        <Field label="Yield amount" error={errors.yield_amount}><NumberInput min="0" value={form.yield_amount} onChange={e => setF('yield_amount', e.target.value)} /></Field>
        <Field label="Yield unit" error={errors.yield_unit}>
          <Select value={form.yield_unit} onChange={e => setF('yield_unit', e.target.value)} placeholder="No unit" options={yieldUnits} />
        </Field>
        <Field label="Use by" error={errors.expires_on} hint="Leave empty to use the shelf life from the plan.">
          <DateInput value={form.expires_on} onChange={e => setF('expires_on', e.target.value)} />
        </Field>
        <p><Checkbox label="Add it to the cabinet as a new jar" checked={addJar} onChange={e => setAddJar(e.target.checked)} /></p>
        {addJar && (
          <fieldset className="finish-jar">
            <legend>The new jar</legend>
            <Field label="Section" error={err('section_id')}>
              <Select value={sectionId} onChange={e => setJ('section_id', e.target.value)} placeholder="Choose a section"
                options={list.map(x => ({ value: String(x.id), label: x.name }))} />
            </Field>
            <Field label="Name" error={err('name')}><TextInput value={jar.name} onChange={e => setJ('name', e.target.value)} /></Field>
            <Field label="Amount" error={err('amount')}><NumberInput min="0" value={jarAmount} onChange={e => setJ('amount', e.target.value)} /></Field>
            <Field label="Unit" error={err('unit')} hint={jarUnit === '' ? 'Pick a cabinet unit for the jar' : undefined}>
              <Select value={jarUnit} onChange={e => setJ('unit', e.target.value)} placeholder="Choose a unit" options={UNITS} />
            </Field>
            <Field label="Storage spot" error={err('storage_spot')}><TextInput value={jar.storage_spot} onChange={e => setJ('storage_spot', e.target.value)} /></Field>
          </fieldset>
        )}
      </form>
    </Dialog>
  );
}
