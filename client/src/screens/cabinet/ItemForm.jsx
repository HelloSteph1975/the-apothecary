import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, NumberInput, DateInput, TextArea, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';
import { todayString } from '../../lib/today.js';
import { UNITS, FORMS, PLANT_PARTS } from '../../lib/cabinet.js';
import { SourceFields } from './SourceFields.jsx';

const s = v => (v == null ? '' : String(v));
const toNum = v => (v === '' || v == null ? null : Number(v));
const orNull = v => (v === '' || v == null ? null : v);

const fromItem = it => ({
  section_id: s(it.section_id), name: s(it.name), size_label: s(it.size_label), amount: s(it.amount), unit: it.unit || 'g',
  low_threshold: s(it.low_threshold), storage_spot: s(it.storage_spot), notes: s(it.notes),
  latin_name: s(it.latin_name), form: s(it.form), plant_part: s(it.plant_part),
  source_kind: s(it.source_kind), source_place: s(it.source_place), source_from: s(it.source_from),
  acquired_on: s(it.acquired_on), expires_on: s(it.expires_on),
  supplier_id: '', price: '', order_note: '',
});

const toPayload = (f, herb) => ({
  section_id: toNum(f.section_id), name: f.name.trim(), size_label: orNull(f.size_label),
  amount: toNum(f.amount), unit: f.unit, low_threshold: toNum(f.low_threshold),
  storage_spot: orNull(f.storage_spot), notes: orNull(f.notes),
  latin_name: herb ? orNull(f.latin_name) : null, form: herb ? orNull(f.form) : null, plant_part: herb ? orNull(f.plant_part) : null,
  source_kind: orNull(f.source_kind),
  source_place: f.source_kind === 'foraged' ? orNull(f.source_place) : null,
  source_from: f.source_kind === 'gifted' ? orNull(f.source_from) : null,
  acquired_on: f.source_kind ? orNull(f.acquired_on) : null,
  expires_on: orNull(f.expires_on),
});

export function ItemForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const sections = useApi('/api/sections');
  const suppliers = useApi('/api/suppliers');
  const spots = useApi('/api/storage-spots');
  const item = useApi(editing ? `/api/items/${id}?today=${todayString()}` : null);

  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});
  const [extraSuppliers, setExtraSuppliers] = useState([]);
  const [suggested, setSuggested] = useState(false);
  const typedExpiry = useRef(false);
  const suggestedRef = useRef(false);
  const initialKey = useRef('');

  useEffect(() => {
    if (form || !sections.data || (editing && !item.data)) return;
    const start = editing
      ? fromItem(item.data)
      : { ...fromItem({}), section_id: sections.data.some(x => String(x.id) === params.get('section')) ? params.get('section') : '' };
    setForm(start);
    setInitial(JSON.stringify(start));
    typedExpiry.current = Boolean(start.expires_on);
    initialKey.current = editing ? `${start.form}|${start.acquired_on}` : '';
  }, [form, sections.data, item.data, editing, params]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };
  const err = k => errors[k] ?? errors[`purchase.${k}`];

  // Suggest a use by date from the form and the date, unless she typed her own.
  const formKind = form?.form;
  const date = form?.acquired_on;
  useEffect(() => {
    if (!formKind || !date || typedExpiry.current) return undefined;
    // Editing: wait until she changes Form or Date before suggesting.
    if (`${formKind}|${date}` === initialKey.current) return undefined;
    let live = true;
    api.get(`/api/expiry-suggestion?form=${encodeURIComponent(formKind)}&acquired_on=${encodeURIComponent(date)}`).then(r => {
      if (!live || typedExpiry.current) return;
      if (!r?.expires_on) {
        // The old suggestion no longer applies. Clear it, but never a typed date.
        if (suggestedRef.current) { setForm(f => ({ ...f, expires_on: '' })); suggestedRef.current = false; setSuggested(false); }
        return;
      }
      setForm(f => ({ ...f, expires_on: r.expires_on }));
      suggestedRef.current = true;
      setSuggested(true);
    }, () => {});
    return () => { live = false; };
  }, [formKind, date]);

  const dirty = Boolean(form) && JSON.stringify(form) !== initial;
  const markSaved = useLeaveGuard(dirty);

  const sectionKind = sections.data?.find(x => String(x.id) === form?.section_id)?.kind;
  const herb = sectionKind === 'herb';

  async function save(e) {
    e.preventDefault();
    const body = toPayload(form, herb);
    if (!editing && form.source_kind === 'bought') {
      body.purchase = { supplier_id: toNum(form.supplier_id), purchased_on: orNull(form.acquired_on), price: toNum(form.price), order_note: orNull(form.order_note) };
    }
    try {
      const result = editing ? await api.patch(`/api/items/${id}`, body) : await api.post('/api/items', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/cabinet/items/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
    }
  }

  const loadError = sections.error || item.error;
  if (loadError) return <><PageHeader title="Add to the cabinet" /><p role="alert">{loadError.message}</p></>;
  if (!form) return <PageHeader title={editing ? 'Edit item' : 'Add to the cabinet'} />;

  const back = editing ? `/cabinet/items/${id}` : '/cabinet';
  const allSuppliers = [...(suppliers.data ?? []), ...extraSuppliers.filter(x => !(suppliers.data ?? []).some(y => y.id === x.id))];
  return (
    <>
      <PageHeader title={editing ? `Edit ${item.data.name}` : 'Add to the cabinet'} />
      <form onSubmit={save} noValidate>
        <div className="card-grid">
          <ParchmentCard title="What it is">
            <Field label="Section (required)" error={err('section_id')}>
              <Select required aria-required="true" value={form.section_id} onChange={e => set('section_id', e.target.value)} placeholder="Choose a section"
                options={sections.data.map(x => ({ value: String(x.id), label: x.name }))} />
            </Field>
            <Field label="Name (required)" error={err('name')}>
              <TextInput required aria-required="true" value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>
            {herb && (
              <>
                <Field label="Latin name" error={err('latin_name')}>
                  <TextInput value={form.latin_name} onChange={e => set('latin_name', e.target.value)} />
                </Field>
                <Field label="Form" error={err('form')}>
                  <Select value={form.form} onChange={e => set('form', e.target.value)} placeholder="Not set" options={FORMS} />
                </Field>
                <Field label="Plant part" error={err('plant_part')}>
                  <Select value={form.plant_part} onChange={e => set('plant_part', e.target.value)} placeholder="Not set" options={PLANT_PARTS} />
                </Field>
              </>
            )}
            <Field label="Size or capacity" hint="For example 30 ml amber dropper, 2 oz tin" error={err('size_label')}>
              <TextInput value={form.size_label} onChange={e => set('size_label', e.target.value)} />
            </Field>
            <Field label="Amount (required)" error={err('amount')}>
              <NumberInput required aria-required="true" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </Field>
            <Field label="Unit" error={err('unit')}>
              <Select value={form.unit} onChange={e => set('unit', e.target.value)} options={UNITS} />
            </Field>
            <Field label="Low when at or below" hint="Leave empty if you don't want a reminder" error={err('low_threshold')}>
              <NumberInput min="0" value={form.low_threshold} onChange={e => set('low_threshold', e.target.value)} />
            </Field>
            <Field label="Storage spot" error={err('storage_spot')}>
              <TextInput list="storage-spots" value={form.storage_spot} onChange={e => set('storage_spot', e.target.value)} />
            </Field>
            <datalist id="storage-spots">{(spots.data ?? []).map(x => <option key={x} value={x} />)}</datalist>
            <Field label="Notes" error={err('notes')}>
              <TextArea value={form.notes} onChange={e => set('notes', e.target.value)} />
            </Field>
          </ParchmentCard>

          <ParchmentCard title="Where it came from">
            <SourceFields form={form} set={set} err={err} editing={editing} suppliers={allSuppliers}
              onSupplierAdded={created => { setExtraSuppliers(x => [...x, created]); suppliers.reload(); }} />
            <Field label="Use by" hint={suggested ? 'Suggested from the form. Change it if you like.' : undefined} error={err('expires_on')}>
              <DateInput value={form.expires_on} onChange={e => { typedExpiry.current = e.target.value !== ''; suggestedRef.current = false; setSuggested(false); set('expires_on', e.target.value); }} />
            </Field>
          </ParchmentCard>
        </div>
        <p className="page-actions">
          <WaxSeal type="submit">Save</WaxSeal>
          <Link to={back}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
