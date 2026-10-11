import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, NumberInput, TextArea, DateInput, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { isDay } from '../../lib/calendar.js';
import { todayString } from '../../lib/today.js';
import { UNITS } from '../../lib/cabinet.js';
import { GARDEN_KINDS, FORAGING_NOTE } from '../../lib/garden.js';

const NONE = 'none';
const s = v => (v == null ? '' : String(v));
const toNum = v => (v === '' || v == null ? null : Number(v));
const orNull = v => (v.trim() === '' ? null : v.trim());

export function GardenEntryForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const entry = useApi(editing ? `/api/garden/entries/${id}` : null);
  const plants = useApi('/api/garden/plants?status=growing');
  const herbs = useApi('/api/herbs');
  // A plant that has ended is not in the growing list, so a link to log something for it loads that plant by itself.
  const wanted = editing ? null : params.get('plant');
  const missing = plants.data && wanted && /^\d+$/.test(wanted) && !plants.data.some(p => String(p.id) === wanted);
  const extra = useApi(missing ? `/api/garden/plants/${wanted}` : null);
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // Once she types a place herself, changing the plant no longer clears it.
  const placeTyped = useRef(false);

  const ready = plants.data && herbs.data && (!editing || entry.data) && (!missing || extra.data || extra.error);
  useEffect(() => {
    if (form || !ready) return;
    let start;
    if (editing) {
      const e = entry.data;
      // A deleted plant stays selected, so an unrelated edit never detaches the entry from it.
      const linked = e.plant ? String(e.plant.id) : NONE;
      start = {
        entry_date: s(e.entry_date), kind: s(e.kind), plant: linked, plant_name: linked === NONE ? s(e.plant_name) : '',
        herb_id: linked === NONE ? s(e.herb_id) : '', place: s(e.place), amount: s(e.amount), unit: s(e.unit),
        weather: s(e.weather), notes: s(e.notes),
      };
    } else {
      const plant = plants.data.find(p => String(p.id) === wanted) ?? (extra.data && String(extra.data.id) === wanted ? extra.data : null);
      const kind = params.get('kind');
      const date = params.get('date');
      start = {
        entry_date: isDay(date) ? date : todayString(), kind: GARDEN_KINDS.some(k => k.value === kind) ? kind : '',
        plant: plant ? String(plant.id) : NONE, plant_name: '', herb_id: '', place: '', amount: '', unit: '', weather: '', notes: '',
      };
    }
    setForm(start);
    setInitial(JSON.stringify(start));
  }, [form, ready, editing, entry.data, plants.data, extra.data, wanted, params]);

  const dirty = Boolean(form) && JSON.stringify(form) !== initial;
  const markSaved = useLeaveGuard(dirty);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const pickPlant = value => {
    // The server only applies the new plant's place when the place is blank, so clear an old one unless she typed it.
    setForm(f => ({ ...f, plant: value, place: placeTyped.current ? f.place : '' }));
    setErrors(e => ({ ...e, plant_id: undefined, plant_name: undefined }));
  };

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const other = form.plant === NONE;
    const body = {
      entry_date: form.entry_date, kind: form.kind,
      place: form.place.trim(), amount: toNum(form.amount), unit: form.unit === '' ? null : form.unit,
      weather: orNull(form.weather), notes: form.notes.trim() === '' ? null : form.notes,
      plant_id: other ? null : Number(form.plant),
    };
    if (other) {
      body.plant_name = form.plant_name.trim();
      body.herb_id = toNum(form.herb_id);
    }
    try {
      const result = editing ? await api.patch(`/api/garden/entries/${id}`, body) : await api.post('/api/garden/entries', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/garden/entries/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
      savingRef.current = false;
      setSaving(false);
    }
  }

  const heading = editing ? 'Edit entry' : 'Log something';
  const loadError = (editing && entry.error) || plants.error || herbs.error;
  if (loadError) {
    const retry = () => [entry, plants, herbs].forEach(a => { if (a.error) a.reload(); });
    return (
      <>
        <PageHeader title={heading} />
        <p role="alert">{loadError.message}</p>
        <Button onClick={retry}>Try again</Button>
      </>
    );
  }
  if (!form) return <PageHeader title={heading} />;

  const plantOptions = [{ value: NONE, label: 'Something else' }, ...plants.data.map(p => ({ value: String(p.id), label: p.name }))];
  // The plant this entry already belongs to stays pickable even if it has since ended.
  if (form.plant !== NONE && !plantOptions.some(o => o.value === form.plant)) {
    const gone = entry.data?.plant && !entry.data.plant.live;
    plantOptions.push({ value: form.plant, label: `${entry.data?.plant?.name ?? extra.data?.name ?? 'This plant'}${gone ? ' (no longer here)' : ''}` });
  }
  const herbOptions = herbs.data.map(h => ({ value: String(h.id), label: h.common_name }));
  // A herb that left the grimoire stays linked unless she picks another, so saving never unlinks it silently.
  if (form.herb_id !== '' && !herbOptions.some(o => o.value === form.herb_id)) {
    herbOptions.unshift({ value: form.herb_id, label: `${entry.data?.herb?.name ?? 'Herb'} (no longer in the grimoire)` });
  }

  return (
    <>
      <PageHeader title={editing ? `Edit ${entry.data.title}` : heading} />
      {form.kind === 'foraged' && <ParchmentCard title="Before you forage"><p>{FORAGING_NOTE}</p></ParchmentCard>}
      <form onSubmit={save} noValidate>
        <ParchmentCard title="What you did">
          <Field label="Date" error={errors.entry_date}>
            <DateInput value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
          </Field>
          <Field label="What you did (required)" error={errors.kind}>
            <Select required aria-required="true" value={form.kind} onChange={e => set('kind', e.target.value)} placeholder="Pick one" options={GARDEN_KINDS} />
          </Field>
          <Field label="Plant" error={errors.plant_id}>
            <Select value={form.plant} onChange={e => pickPlant(e.target.value)} options={plantOptions} />
          </Field>
          {form.plant === NONE && (
            <>
              <Field label="Name (required)" error={errors.plant_name}>
                <TextInput required aria-required="true" value={form.plant_name} onChange={e => set('plant_name', e.target.value)} />
              </Field>
              <Field label="Grimoire herb" hint="Optional. Links this entry to your grimoire notes." error={errors.herb_id}>
                <Select value={form.herb_id} onChange={e => set('herb_id', e.target.value)} placeholder="No herb" options={herbOptions} />
              </Field>
            </>
          )}
          <Field label="Place" hint={form.plant === NONE ? 'Optional' : 'Leave empty to use the place of the plant'} error={errors.place}>
            <TextInput value={form.place} onChange={e => { placeTyped.current = true; set('place', e.target.value); }} />
          </Field>
          <Field label="Amount" error={errors.amount}>
            <NumberInput min="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </Field>
          <Field label="Unit" error={errors.unit}>
            <Select value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="No unit" options={UNITS} />
          </Field>
          <Field label="Weather" hint="Optional, like Sunny, 18 C" error={errors.weather}>
            <TextInput value={form.weather} onChange={e => set('weather', e.target.value)} />
          </Field>
          <Field label="Notes" error={errors.notes}>
            <TextArea rows={5} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </ParchmentCard>
        <p className="page-actions">
          <WaxSeal type="submit" disabled={saving}>Save</WaxSeal>
          <Link to={editing ? `/garden/entries/${id}` : '/garden/log'}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
