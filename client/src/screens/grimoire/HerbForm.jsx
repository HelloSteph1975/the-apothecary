import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, TextArea, Select, Checkbox } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { AHPA_CLASSES, AHPA_LABELS, CAUTION_FIELDS, ELEMENTS, HERB_PARTS, PLANETS, RECIPE_TYPES } from '../../lib/grimoire.js';
import { SourcesEditor, newSource } from './SourcesEditor.jsx';

const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const arr = v => (Array.isArray(v) ? v : []);
const commaText = v => arr(v).join(', ');
const splitComma = v => v.split(',').map(x => x.trim()).filter(Boolean);
const GENDERS = [{ value: 'masculine', label: 'Masculine' }, { value: 'feminine', label: 'Feminine' }];
const AHPA_OPTIONS = AHPA_CLASSES.map(c => ({ value: c, label: AHPA_LABELS[c] }));
const CAUTION_HINTS = {
  caution_pregnancy: 'Anything to know if pregnant, trying, or nursing.',
  caution_medications: 'Medicines it may interact with.',
  caution_conditions: 'Health conditions that call for care.',
  caution_duration: 'Limits on how long or how much.',
  caution_topical: 'Skin sensitivity or patch test notes.',
};
const TEXT_KEYS = ['common_name', 'latin_name', 'family', 'uses', 'taste', 'energetics', 'planet', 'element', 'gender', 'ahpa_class',
  'garden_harvest_part', 'garden_harvest_timing', 'garden_sun', 'garden_water', 'notes', ...CAUTION_FIELDS.map(c => c[0])];
const COMMA_KEYS = ['other_names', 'zodiac', 'associations', 'garden_companions'];

function fromHerb(h) {
  const form = { parts_used: arr(h.parts_used), preparations: arr(h.preparations) };
  for (const k of COMMA_KEYS) form[k] = commaText(h[k]);
  for (const k of TEXT_KEYS) form[k] = s(h[k]);
  return form;
}
const startSources = h => arr(h.sources).map(x => newSource(x));
const plainSources = list => list.map(({ key, ...rest }) => rest);

export function HerbForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const herb = useApi(editing ? `/api/herbs/${id}` : null);
  const [form, setForm] = useState(null);
  const [sources, setSources] = useState([]);
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});
  const groupId = useId();

  useEffect(() => {
    if (form || (editing && !herb.data)) return;
    const data = editing ? herb.data : {};
    const f = fromHerb(data);
    const src = startSources(data);
    setForm(f);
    setSources(src);
    setInitial(JSON.stringify([f, plainSources(src)]));
  }, [form, editing, herb.data]);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dirty = Boolean(form) && JSON.stringify([form, plainSources(sources)]) !== initial;
  const markSaved = useLeaveGuard(dirty);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };
  // Source errors are keyed by row index, so any change to the list makes them stale.
  const changeSources = next => {
    setSources(next);
    setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sources' && !k.startsWith('sources.'))));
  };
  const toggle = (k, value, on) => set(k, on ? [...form[k], value] : form[k].filter(x => x !== value));
  const order = (all, picked) => all.map(o => o.value).filter(v => picked.includes(v));

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const body = {
      parts_used: order(HERB_PARTS, form.parts_used), preparations: order(RECIPE_TYPES, form.preparations),
      sources: sources.map(x => {
        const year = x.year.trim();
        // Anything but digits goes as typed, so the server's "Must be a number" lands on this row.
        return { title: x.title.trim(), author: orNull(x.author), year: year === '' ? null : /^\d+$/.test(year) ? Number(year) : year,
          url: orNull(x.url), covers: x.covers };
      }),
    };
    for (const k of COMMA_KEYS) body[k] = splitComma(form[k]);
    for (const k of TEXT_KEYS) body[k] = orNull(form[k]);
    body.common_name = form.common_name.trim();
    try {
      const result = editing ? await api.patch(`/api/herbs/${id}`, body) : await api.post('/api/herbs', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/grimoire/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
      savingRef.current = false;
      setSaving(false);
    }
  }

  const heading = editing ? 'Edit herb' : 'Add an herb';
  if (herb.error) return <><PageHeader title={heading} /><p role="alert">{herb.error.message}</p></>;
  if (!form) return <PageHeader title={heading} />;

  const text = (k, label, hint) => (
    <Field label={label} error={errors[k]} hint={hint}>
      <TextInput value={form[k]} onChange={e => set(k, e.target.value)} />
    </Field>
  );
  const area = (k, label, hint) => (
    <Field label={label} error={errors[k]} hint={hint}>
      <TextArea value={form[k]} onChange={e => set(k, e.target.value)} />
    </Field>
  );
  const checks = (k, label, options) => {
    const errorId = `${groupId}-${k}-error`;
    return (
      <fieldset className="check-group" aria-describedby={errors[k] ? errorId : undefined}>
        <legend className="field-hint">{label}</legend>
        {options.map(o => (
          <Checkbox key={o.value} label={o.label} checked={form[k].includes(o.value)} onChange={e => toggle(k, o.value, e.target.checked)} />
        ))}
        {errors[k] && <small id={errorId} className="field-error" role="alert">{errors[k]}</small>}
      </fieldset>
    );
  };
  const commas = 'Separate with commas.';

  return (
    <>
      <PageHeader title={editing ? `Edit ${herb.data.common_name}` : heading} />
      {editing && herb.data.is_starter ? (
        <p className="muted">{"This is one of the starter herbs. Your changes are kept and won't be overwritten."}</p>
      ) : null}
      <form onSubmit={save} noValidate>
        <ParchmentCard title="Names">
          <Field label="Common name (required)" error={errors.common_name}>
            <TextInput required aria-required="true" value={form.common_name} onChange={e => set('common_name', e.target.value)} />
          </Field>
          {text('other_names', 'Other names', commas)}
          {text('latin_name', 'Latin name')}
          {text('family', 'Family')}
        </ParchmentCard>
        <ParchmentCard title="Uses">
          {checks('parts_used', 'Parts used', HERB_PARTS)}
          {area('uses', 'Uses')}
          {checks('preparations', 'Preparations', RECIPE_TYPES)}
          {text('taste', 'Taste')}
          {text('energetics', 'Energetics')}
        </ParchmentCard>
        <ParchmentCard title="Cautions">
          {CAUTION_FIELDS.map(([k, label]) => <div key={k}>{area(k, label, CAUTION_HINTS[k])}</div>)}
          <Field label="AHPA class" error={errors.ahpa_class}>
            <Select value={form.ahpa_class} onChange={e => set('ahpa_class', e.target.value)} placeholder="Not known" options={AHPA_OPTIONS} />
          </Field>
        </ParchmentCard>
        <ParchmentCard title="Correspondences">
          <Field label="Planet" error={errors.planet}>
            <Select value={form.planet} onChange={e => set('planet', e.target.value)} placeholder="Not set" options={PLANETS} />
          </Field>
          <Field label="Element" error={errors.element}>
            <Select value={form.element} onChange={e => set('element', e.target.value)} placeholder="Not set" options={ELEMENTS} />
          </Field>
          {text('zodiac', 'Zodiac signs', commas)}
          {text('associations', 'Associations', commas)}
          <Field label="Gender" error={errors.gender}>
            <Select value={form.gender} onChange={e => set('gender', e.target.value)} placeholder="Not set" options={GENDERS} />
          </Field>
        </ParchmentCard>
        <ParchmentCard title="Garden">
          {text('garden_harvest_part', 'Part harvested')}
          {text('garden_harvest_timing', 'Harvest timing')}
          {text('garden_sun', 'Sun')}
          {text('garden_water', 'Water')}
          {text('garden_companions', 'Grows well with', commas)}
        </ParchmentCard>
        <ParchmentCard title="Notes">
          {area('notes', 'Notes')}
        </ParchmentCard>
        <ParchmentCard title="Sources">
          <SourcesEditor sources={sources} onChange={changeSources} errors={errors} />
        </ParchmentCard>
        <p className="page-actions">
          <WaxSeal type="submit" disabled={saving}>Save</WaxSeal>
          <Link to={editing ? `/grimoire/${id}` : '/grimoire'}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
