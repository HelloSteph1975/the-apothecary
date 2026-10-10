import { useEffect, useRef, useState } from 'react';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, NumberInput, Select } from '../../components/Field.jsx';
import { formatAmount } from '../../lib/cabinet.js';

const PRESETS = [['0.5', 'Half'], ['1', 'As written'], ['2', 'Double'], ['3', 'Triple']];
const num = n => String(Math.round(n * 100) / 100);

export function ScaleControl({ recipe, scaleParam, yieldParam, setScale, error, badLink }) {
  const isPreset = PRESETS.some(([v]) => v === scaleParam);
  const [mode, setMode] = useState(scaleParam && !isPreset ? 'other' : scaleParam || '1');
  const [other, setOther] = useState(scaleParam && !isPreset ? scaleParam : '');
  const [target, setTarget] = useState(yieldParam || '');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (scale, yieldValue) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setScale(scale, yieldValue), 300);
  };
  const onMode = e => {
    const v = e.target.value;
    setMode(v);
    setTarget('');
    if (v === 'other') push(other, '');
    else push(v === '1' ? '' : v, '');
  };
  const onOther = e => { setOther(e.target.value); setTarget(''); push(e.target.value, ''); };
  const onTarget = e => { setTarget(e.target.value); setMode('1'); setOther(''); push('', e.target.value); };
  const reset = () => {
    clearTimeout(timer.current);
    setMode('1'); setOther(''); setTarget('');
    setScale('', '');
  };

  const scaled = recipe.factor !== 1;
  const unit = recipe.yield_unit;
  return (
    <ParchmentCard title="Scale">
      <div className="toolbar">
        <Field label="Make" error={mode !== 'other' && !target ? error?.scale : undefined}>
          <Select options={[...PRESETS.map(([value, label]) => ({ value, label })), { value: 'other', label: 'Other' }]}
            value={mode} onChange={onMode} />
        </Field>
        {mode === 'other' && (
          <Field label="Factor" error={error?.scale}>
            <NumberInput min="0.01" max="100" value={other} onChange={onOther} />
          </Field>
        )}
        {recipe.yield_amount > 0 && (
          <Field label={`Or make (${unit || 'amount'})`} error={error?.yield}>
            <NumberInput min="0" value={target} onChange={onTarget} />
          </Field>
        )}
      </div>
      <p role="status" className={scaled ? undefined : 'muted'}>
        {scaled
          ? `Scaled to ${num(recipe.factor)}×${recipe.scaled_yield_amount != null ? `: makes ${formatAmount(recipe.scaled_yield_amount, unit)}` : ''}`
          : badLink ? "The scale in that link wasn't valid, so this is the recipe as written." : ''}
      </p>
      {scaled && <p><Button variant="secondary" onClick={reset}>Reset</Button></p>}
    </ParchmentCard>
  );
}
