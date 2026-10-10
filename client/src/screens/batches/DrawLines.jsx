import { useEffect, useRef } from 'react';
import { Field, TextInput, NumberInput, Select } from '../../components/Field.jsx';
import { RECIPE_UNITS } from '../../lib/recipes.jsx';
import { formatAmount } from '../../lib/cabinet.js';

let nextKey = 1;
const numOrNull = v => (v === '' || v == null ? null : Number(v));

// Suggested draws come from the server at stock precision; show them to 4 significant figures.
const tidy = n => String(Number(Number(n).toPrecision(4)));

export const newFreeLine = () => ({ key: nextKey++, herb_id: null, name: '', amount: '', unit: '', item_id: '', draw: '' });

// One draw row per planned ingredient, ready for editing.
export function linesFromPlan(plan) {
  return plan.lines.map(l => {
    const pick = l.candidates.find(c => c.id === l.suggested_item_id);
    return {
      key: nextKey++, herb_id: l.herb_id ?? null, name: l.name, amount: l.amount, unit: l.unit, candidates: l.candidates,
      item_id: pick ? String(pick.id) : '', draw: l.suggested_draw == null ? '' : tidy(l.suggested_draw),
    };
  });
}

export function linesBody(lines, free) {
  return lines.map(l => {
    const jar = l.item_id === '' ? null : Number(l.item_id);
    return {
      herb_id: l.herb_id ?? null,
      name: l.name.trim(),
      amount: free ? numOrNull(l.amount) : l.amount ?? null,
      unit: free ? (l.unit || null) : l.unit ?? null,
      item_id: jar,
      drawn_amount: jar != null && l.draw !== '' ? Number(l.draw) : null,
    };
  });
}

const jarLabel = c => `${c.name}, ${formatAmount(c.amount, c.unit)} left`;

function noteFor(line) {
  if (line.candidates.length === 0) return 'No jar in the cabinet matches. You can still make it.';
  if (line.amount == null) return 'No amount in the recipe.';
  const jar = line.candidates.find(c => String(c.id) === line.item_id);
  if (!jar) return null;
  if (jar.draw == null) return `Can't convert ${line.unit} to ${jar.unit}. Enter the amount to draw by hand.`;
  if (line.draw !== '' && Number(line.draw) > jar.amount) return `This jar holds only ${formatAmount(jar.amount, jar.unit)}.`;
  return null;
}

export function DrawLines({ lines, onChange, free = false, items = [], errors = {} }) {
  const addRef = useRef(null);
  const nameRefs = useRef({});
  const focusRef = useRef(null);
  useEffect(() => {
    const f = focusRef.current;
    if (!f) return;
    focusRef.current = null;
    if (f.type === 'add') nameRefs.current[f.key]?.focus();
    else addRef.current?.focus();
  }, [lines]);

  const update = (i, patch) => onChange(lines.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const pickJar = (i, value) => {
    const line = lines[i];
    const pool = free ? items : line.candidates;
    const jar = pool.find(c => String(c.id) === value);
    let draw = '';
    if (jar) {
      if (free) draw = line.amount !== '' && line.unit === jar.unit ? line.amount : '';
      else if (jar.draw != null) draw = tidy(jar.draw);
    }
    update(i, { item_id: value, draw });
  };
  const add = () => {
    const row = newFreeLine();
    focusRef.current = { type: 'add', key: row.key };
    onChange([...lines, row]);
  };
  const remove = i => {
    focusRef.current = { type: 'remove' };
    onChange(lines.filter((_, n) => n !== i));
  };

  return (
    <div className="sources-editor">
      {errors.lines && <p className="field-error" role="alert">{errors.lines}</p>}
      {lines.length === 0 && !free && <p className="muted">This recipe has no ingredients.</p>}
      {lines.map((x, i) => {
        const n = i + 1;
        const err = f => errors[`lines.${i}.${f}`];
        const pool = free ? items : x.candidates;
        const note = free ? null : noteFor(x);
        const jarPicked = pool.find(c => String(c.id) === x.item_id);
        const legend = free ? `Ingredient ${n}` : `${x.amount == null ? '' : `${formatAmount(x.amount, x.unit)} `}${x.name}`;
        return (
          <fieldset key={x.key} className="source-row">
            <legend>{legend}</legend>
            {free && (
              <>
                <Field label="Ingredient name" error={err('name')}>
                  <TextInput ref={el => { nameRefs.current[x.key] = el; }} value={x.name} onChange={e => update(i, { name: e.target.value })} />
                </Field>
                <Field label="Amount" error={err('amount')}>
                  <NumberInput min="0" value={x.amount} onChange={e => update(i, { amount: e.target.value })} />
                </Field>
                <Field label="Unit" error={err('unit')}>
                  <Select value={x.unit} onChange={e => update(i, { unit: e.target.value })} placeholder="No unit" options={RECIPE_UNITS} />
                </Field>
              </>
            )}
            <Field label="From jar" error={err('item_id')}>
              <Select value={x.item_id} onChange={e => pickJar(i, e.target.value)} placeholder="Don't draw from a jar" options={pool.map(c => ({ value: String(c.id), label: jarLabel(c) }))} />
            </Field>
            <Field label={jarPicked ? `Amount to draw (${jarPicked.unit})` : 'Amount to draw'} error={err('drawn_amount')}>
              <NumberInput min="0" disabled={x.item_id === ''} value={x.draw} onChange={e => update(i, { draw: e.target.value })} />
            </Field>
            {note && <p className="muted">{note}</p>}
            {free && <p className="page-actions"><button type="button" className="btn btn-secondary" onClick={() => remove(i)}>{`Remove ingredient ${n}`}</button></p>}
          </fieldset>
        );
      })}
      {free && <p><button type="button" className="btn btn-secondary" ref={addRef} onClick={add}>Add an ingredient</button></p>}
    </div>
  );
}
