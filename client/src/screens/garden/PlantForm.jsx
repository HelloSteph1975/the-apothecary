import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, TextArea, DateInput, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { todayString } from '../../lib/today.js';

const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());

export function PlantForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const plant = useApi(editing ? `/api/garden/plants/${id}` : null);
  const herbs = useApi('/api/herbs');
  const places = useApi('/api/garden/plants?status=all');
  const listId = useId();
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const ready = herbs.data && (!editing || plant.data);
  useEffect(() => {
    if (form || !ready) return;
    let start;
    if (editing) {
      const p = plant.data;
      start = {
        herb_id: s(p.herb_id), name: s(p.name), place: s(p.place), planted_on: s(p.planted_on),
        expected_harvest_on: s(p.expected_harvest_on), ended_on: s(p.ended_on), notes: s(p.notes),
      };
    } else {
      const herb = herbs.data.find(h => String(h.id) === params.get('herb'));
      start = {
        herb_id: herb ? s(herb.id) : '', name: herb ? herb.common_name : '', place: '', planted_on: todayString(),
        expected_harvest_on: '', ended_on: '', notes: '',
      };
    }
    setForm(start);
    setInitial(JSON.stringify(start));
  }, [form, ready, editing, plant.data, herbs.data, params]);

  const dirty = Boolean(form) && JSON.stringify(form) !== initial;
  const markSaved = useLeaveGuard(dirty);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  // Picking a herb names an unnamed plant after it.
  const pickHerb = value => {
    const herb = herbs.data.find(h => String(h.id) === value);
    setForm(f => ({ ...f, herb_id: value, name: f.name.trim() === '' && herb ? herb.common_name : f.name }));
    setErrors(e => ({ ...e, herb_id: undefined, name: undefined }));
  };

  async function save(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const body = {
      herb_id: form.herb_id === '' ? null : Number(form.herb_id),
      name: form.name.trim(),
      place: orNull(form.place),
      planted_on: orNull(form.planted_on),
      expected_harvest_on: orNull(form.expected_harvest_on),
      notes: form.notes.trim() === '' ? null : form.notes,
    };
    if (editing) body.ended_on = orNull(form.ended_on);
    try {
      const result = editing ? await api.patch(`/api/garden/plants/${id}`, body) : await api.post('/api/garden/plants', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/garden/plants/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
      savingRef.current = false;
      setSaving(false);
    }
  }

  const heading = editing ? 'Edit plant' : 'Add a plant';
  const loadError = (editing && plant.error) || herbs.error;
  if (loadError) {
    const retry = () => [plant, herbs].forEach(a => { if (a.error) a.reload(); });
    return (
      <>
        <PageHeader title={heading} />
        <p role="alert">{loadError.message}</p>
        <Button onClick={retry}>Try again</Button>
      </>
    );
  }
  if (!form) return <PageHeader title={heading} />;

  const herbOptions = herbs.data.map(h => ({ value: String(h.id), label: h.common_name }));
  // A herb that was deleted stays linked unless she picks another, so saving never unlinks it silently.
  if (form.herb_id !== '' && !herbOptions.some(o => o.value === form.herb_id)) {
    herbOptions.unshift({ value: form.herb_id, label: `${plant.data?.herb?.name ?? 'Herb'} (no longer in the grimoire)` });
  }
  const used = [...new Set((places.data ?? []).map(p => p.place).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader title={editing ? `Edit ${plant.data.name}` : heading} />
      <form onSubmit={save} noValidate>
        <ParchmentCard title="The plant">
          <Field label="Herb" hint="Optional. Links to your grimoire notes." error={errors.herb_id}>
            <Select value={form.herb_id} onChange={e => pickHerb(e.target.value)} placeholder="No herb" options={herbOptions} />
          </Field>
          <Field label="Name (required)" error={errors.name}>
            <TextInput required aria-required="true" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Place" hint="Optional, like Back bed or Window box" error={errors.place}>
            <TextInput list={listId} value={form.place} onChange={e => set('place', e.target.value)} />
          </Field>
          <datalist id={listId}>{used.map(p => <option key={p} value={p} />)}</datalist>
          <Field label="Planted" error={errors.planted_on}>
            <DateInput value={form.planted_on} onChange={e => set('planted_on', e.target.value)} />
          </Field>
          <Field label="Expected harvest" hint="Optional. A reminder lands on your to-do list that day." error={errors.expected_harvest_on}>
            <DateInput value={form.expected_harvest_on} onChange={e => set('expected_harvest_on', e.target.value)} />
          </Field>
          {editing && (
            <Field label="Ended" hint="Leave empty while it is still growing." error={errors.ended_on}>
              <DateInput value={form.ended_on} onChange={e => set('ended_on', e.target.value)} />
            </Field>
          )}
          <Field label="Notes" error={errors.notes}>
            <TextArea rows={5} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </ParchmentCard>
        <p className="page-actions">
          <WaxSeal type="submit" disabled={saving}>Save</WaxSeal>
          <Link to={editing ? `/garden/plants/${id}` : '/garden'}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
