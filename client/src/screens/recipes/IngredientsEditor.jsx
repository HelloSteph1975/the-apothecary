import { useEffect, useRef } from 'react';
import { Field, TextInput, NumberInput, Select } from '../../components/Field.jsx';
import { RECIPE_UNITS } from '../../lib/recipes.jsx';
import { FORMS, PLANT_PARTS } from '../../lib/cabinet.js';

let nextKey = 1;
export const newIngredient = (ing = {}) => ({
  key: nextKey++,
  // A deleted herb is kept as plain text: the server rejects dead herb ids.
  deletedHerb: Boolean(ing.herb_deleted),
  herb_id: ing.herb_id == null || ing.herb_deleted ? '' : String(ing.herb_id),
  name: ing.name ?? '',
  amount: ing.amount == null ? '' : String(ing.amount),
  unit: ing.unit ?? '',
  form: ing.form ?? '',
  plant_part: ing.plant_part ?? '',
  note: ing.note ?? '',
});

// A saved value that is no longer in the list stays selectable, so editing never blanks it.
const withCurrent = (options, value) => (value && !options.some(o => o.value === value) ? [...options, { value, label: value }] : options);

// Rows of {key, herb_id, name, amount, unit, form, plant_part, note}. `herbs` are the live grimoire herbs.
// `errors` is the server's details object (keys like "ingredients.0.name").
export function IngredientsEditor({ ingredients, onChange, herbs, errors = {} }) {
  const focusRef = useRef(null);
  const addRef = useRef(null);
  const rowRefs = useRef({});
  const removeRefs = useRef({});
  const upRefs = useRef({});
  const downRefs = useRef({});

  useEffect(() => {
    const f = focusRef.current;
    if (!f) return;
    focusRef.current = null;
    if (f.type === 'first') rowRefs.current[f.key]?.focus();
    else if (f.type === 'remove') (removeRefs.current[f.key] ?? addRef.current)?.focus();
    else if (f.type === 'add') addRef.current?.focus();
    else if (f.type === 'move') {
      const up = upRefs.current[f.key], down = downRefs.current[f.key];
      const first = f.dir < 0 ? up : down, second = f.dir < 0 ? down : up;
      (first && !first.disabled ? first : second)?.focus();
    }
  }, [ingredients]);

  const update = (i, patch) => onChange(ingredients.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const pickHerb = (i, value) => {
    const herb = herbs.find(h => String(h.id) === value);
    const patch = { herb_id: value, deletedHerb: false };
    if (herb && ingredients[i].name.trim() === '') patch.name = herb.common_name;
    update(i, patch);
  };
  const add = () => {
    const row = newIngredient();
    focusRef.current = { type: 'first', key: row.key };
    onChange([...ingredients, row]);
  };
  const remove = i => {
    const prev = ingredients[i - 1] ?? null;
    focusRef.current = prev ? { type: 'remove', key: prev.key } : { type: 'add' };
    onChange(ingredients.filter((_, n) => n !== i));
  };
  const move = (i, d) => {
    const next = [...ingredients];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    focusRef.current = { type: 'move', key: ingredients[i].key, dir: d };
    onChange(next);
  };
  const herbOptions = herbs.map(h => ({ value: String(h.id), label: h.common_name }));

  return (
    <div className="sources-editor">
      {errors.ingredients && <p className="field-error" role="alert">{errors.ingredients}</p>}
      {ingredients.length === 0 && <p className="muted">No ingredients yet.</p>}
      {ingredients.map((x, i) => {
        const n = i + 1;
        const err = f => errors[`ingredients.${i}.${f}`];
        return (
          <fieldset key={x.key} className="source-row">
            <legend>{`Ingredient ${n}`}</legend>
            <Field label={`Ingredient ${n} grimoire herb`} error={err('herb_id')}
              hint={x.deletedHerb && !x.herb_id ? `${x.name || 'This herb'} is no longer in the grimoire, so it's kept as plain text.` : undefined}>
              <Select value={x.herb_id} onChange={e => pickHerb(i, e.target.value)} placeholder="Not an herb"
                options={withCurrent(herbOptions, x.herb_id)} />
            </Field>
            <Field label={`Ingredient ${n} name`} hint={x.herb_id ? 'Optional when an herb is picked' : 'Required unless you pick an herb'} error={err('name')}>
              <TextInput ref={el => { rowRefs.current[x.key] = el; }} value={x.name} onChange={e => update(i, { name: e.target.value })} />
            </Field>
            <Field label={`Ingredient ${n} amount`} error={err('amount')}>
              <NumberInput min="0" value={x.amount} onChange={e => update(i, { amount: e.target.value })} />
            </Field>
            <Field label={`Ingredient ${n} unit`} error={err('unit')}>
              <Select value={x.unit} onChange={e => update(i, { unit: e.target.value })} placeholder="No unit" options={withCurrent(RECIPE_UNITS, x.unit)} />
            </Field>
            <Field label={`Ingredient ${n} form`} error={err('form')}>
              <Select value={x.form} onChange={e => update(i, { form: e.target.value })} placeholder="Not set" options={withCurrent(FORMS, x.form)} />
            </Field>
            <Field label={`Ingredient ${n} plant part`} error={err('plant_part')}>
              <Select value={x.plant_part} onChange={e => update(i, { plant_part: e.target.value })} placeholder="Not set" options={withCurrent(PLANT_PARTS, x.plant_part)} />
            </Field>
            <Field label={`Ingredient ${n} note`} error={err('note')}>
              <TextInput value={x.note} onChange={e => update(i, { note: e.target.value })} />
            </Field>
            <p className="page-actions">
              <button type="button" className="btn btn-secondary" ref={el => { upRefs.current[x.key] = el; }} disabled={i === 0} onClick={() => move(i, -1)}>{`Move ingredient ${n} up`}</button>
              <button type="button" className="btn btn-secondary" ref={el => { downRefs.current[x.key] = el; }} disabled={i === ingredients.length - 1} onClick={() => move(i, 1)}>{`Move ingredient ${n} down`}</button>
              <button type="button" className="btn btn-secondary" ref={el => { removeRefs.current[x.key] = el; }} onClick={() => remove(i)}>{`Remove ingredient ${n}`}</button>
            </p>
          </fieldset>
        );
      })}
      <p><button type="button" className="btn btn-secondary" ref={addRef} onClick={add}>Add an ingredient</button></p>
    </div>
  );
}
