import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, NumberInput, Select } from '../../components/Field.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { formatAmount } from '../../lib/cabinet.js';
import { CAUTION_FIELDS } from '../../lib/grimoire.js';
import { daysText, shelfText } from '../../lib/recipes.jsx';

const PRESETS = [['0.5', '1/2×'], ['1', '1×'], ['2', '2×'], ['3', '3×']];
const FIELD_LABELS = Object.fromEntries(CAUTION_FIELDS);
const num = n => String(Math.round(n * 100) / 100);

function ScalePanel({ recipe, scaleParam, yieldParam, setScale, error }) {
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
          <Field label={`or make (${unit || 'amount'})`} error={error?.yield}>
            <NumberInput min="0" value={target} onChange={onTarget} />
          </Field>
        )}
      </div>
      {scaled && (
        <p>
          Scaled to {num(recipe.factor)}×{recipe.scaled_yield_amount != null && `: makes ${formatAmount(recipe.scaled_yield_amount, unit)}`}{' '}
          <Button variant="secondary" onClick={reset}>Reset</Button>
        </p>
      )}
    </ParchmentCard>
  );
}

export function RecipePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const del = useDeleteWithUndo();
  const [params, setParams] = useSearchParams();
  const scaleParam = params.get('scale') || '';
  const yieldParam = params.get('yield') || '';
  const [recipe, setRecipe] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams();
    if (scaleParam) q.set('scale', scaleParam);
    else if (yieldParam) q.set('yield', yieldParam);
    const qs = q.toString();
    api.get(`/api/recipes/${id}${qs ? `?${qs}` : ''}`).then(
      data => { if (live) { setRecipe(data); setLoadError(null); setFieldError(null); } },
      err => {
        if (!live) return;
        if (err.status === 400 && (err.details?.scale || err.details?.yield)) setFieldError(err.details);
        else { setLoadError(err); setRecipe(null); }
      },
    );
    return () => { live = false; };
  }, [id, scaleParam, yieldParam, tick]);

  const setScale = (scale, yieldValue) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('scale'); next.delete('yield');
      if (scale) next.set('scale', scale);
      else if (yieldValue) next.set('yield', yieldValue);
      return next;
    }, { replace: true });
  };

  if (loadError) {
    return (
      <>
        <PageHeader title="Recipe book" />
        <p role="alert">{loadError.message}</p>
        <Button onClick={() => { setLoadError(null); setTick(t => t + 1); }}>Try again</Button>
      </>
    );
  }
  if (!recipe) return <><PageHeader title="Recipe book" /><p>Opening the page…</p></>;

  const steps = (recipe.steps || '').split('\n').map(s => s.trim()).filter(Boolean);
  const yieldText = recipe.yield_amount == null ? '' : `makes ${formatAmount(recipe.yield_amount, recipe.yield_unit)}`;
  const subtitle = [recipe.type?.name, yieldText].filter(Boolean).join(', ');
  const wait = daysText(recipe.effective_wait_days);
  const shelf = shelfText(recipe.effective_shelf_life_days);
  const hasCautions = recipe.needs_patch_test || recipe.label_caution || recipe.cautions.length > 0;
  const aboutRows = [['Wait', wait], ['Shelf life', shelf], ['Intention', recipe.intention], ['Best timing', recipe.timing_notes], ['Notes', recipe.notes]].filter(([, v]) => v);

  return (
    <>
      <PageHeader title={recipe.name} subtitle={subtitle}
        actions={(
          <>
            <Button as={Link} variant="secondary" to={`/recipes/${recipe.id}/edit`}>Edit</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/recipes/${recipe.id}`, label: recipe.name, onUndo: () => navigate(`/recipes/${recipe.id}`) })) navigate('/recipes');
            }}>Delete</Button>
          </>
        )} />
      <div className="card-grid">
        <ParchmentCard title="Before you make it" className="panel-caution panel-wide">
          {recipe.needs_patch_test && (
            <p>Patch test first: dab a little on the inside of your arm and wait a day before using it more widely.</p>
          )}
          {recipe.label_caution && <p>{recipe.label_caution}</p>}
          {recipe.cautions.map(c => (
            <Fragment key={c.herb_id}>
              <h3><Link to={`/grimoire/${c.herb_id}`}>{c.common_name}</Link></h3>
              <dl className="dl-grid dl-cautions">
                {c.items.map(i => <Fragment key={i.field}><dt>{FIELD_LABELS[i.field] ?? i.field}</dt><dd>{i.text}</dd></Fragment>)}
              </dl>
            </Fragment>
          ))}
          {!hasCautions && <p>No cautions recorded for these ingredients. Check each herb before you make it.</p>}
          <p className="muted">For learning and folk tradition. Not medical advice; check with a qualified practitioner, especially if you're pregnant, nursing or take medicines.</p>
        </ParchmentCard>

        <ScalePanel recipe={recipe} scaleParam={scaleParam} yieldParam={yieldParam} setScale={setScale} error={fieldError} />

        <ParchmentCard title="Ingredients">
          {recipe.ingredients.length === 0 ? <p className="muted">No ingredients yet.</p> : (
            <ul>
              {recipe.ingredients.map(i => {
                const amount = i.amount == null ? '' : formatAmount(i.amount, i.unit);
                const meta = [i.form, i.plant_part, i.note].filter(Boolean).join(', ');
                return (
                  <li key={i.id}>
                    {amount && <span>{amount} </span>}
                    {i.herb_name ? <Link to={`/grimoire/${i.herb_id}`}>{i.herb_name}</Link> : <span>{i.name}</span>}
                    {i.herb_deleted && <span className="muted"> (no longer in the grimoire)</span>}
                    {meta && <span className="muted">, {meta}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </ParchmentCard>

        {steps.length > 0 && (
          <ParchmentCard title="Steps">
            <ol>{steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
          </ParchmentCard>
        )}

        {aboutRows.length > 0 && (
          <ParchmentCard title="About">
            <dl className="dl-grid">
              {aboutRows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
            </dl>
          </ParchmentCard>
        )}

        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="recipe" ownerId={recipe.id} photos={recipe.photos ?? []} onChange={() => setTick(t => t + 1)} />
        </ParchmentCard>
      </div>
    </>
  );
}
