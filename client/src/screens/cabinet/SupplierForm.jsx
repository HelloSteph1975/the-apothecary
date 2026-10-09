import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { Field, TextInput, TextArea, Select } from '../../components/Field.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useLeaveGuard } from '../../lib/useLeaveGuard.js';

const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const RATINGS = [1, 2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }));
const BAD_URL = 'Enter a web address starting with https://';

const fromSupplier = x => ({
  name: s(x.name), website: s(x.website), contact: s(x.contact), good_for: s(x.good_for), rating: s(x.rating), notes: s(x.notes),
});

export function SupplierForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const supplier = useApi(editing ? `/api/suppliers/${id}` : null);
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (form || (editing && !supplier.data)) return;
    const start = fromSupplier(editing ? supplier.data : {});
    setForm(start);
    setInitial(JSON.stringify(start));
  }, [form, editing, supplier.data]);

  const dirty = Boolean(form) && JSON.stringify(form) !== initial;
  const markSaved = useLeaveGuard(dirty);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  async function save(e) {
    e.preventDefault();
    const site = form.website.trim();
    if (site && !/^https?:\/\/\S+/i.test(site)) { setErrors({ website: BAD_URL }); return; }
    const body = {
      name: form.name.trim(), website: orNull(form.website), contact: orNull(form.contact),
      good_for: orNull(form.good_for), rating: form.rating === '' ? null : Number(form.rating), notes: orNull(form.notes),
    };
    try {
      const result = editing ? await api.patch(`/api/suppliers/${id}`, body) : await api.post('/api/suppliers', body);
      markSaved();
      toast.show({ message: 'Saved' });
      navigate(`/cabinet/suppliers/${result?.id ?? id}`);
    } catch (ex) {
      setErrors(ex.details ?? {});
      toast.show({ message: ex.message, duration: 6000 });
    }
  }

  if (supplier.error) return <><PageHeader title={editing ? 'Edit supplier' : 'Add a supplier'} /><p role="alert">{supplier.error.message}</p></>;
  if (!form) return <PageHeader title={editing ? 'Edit supplier' : 'Add a supplier'} />;

  return (
    <>
      <PageHeader title={editing ? `Edit ${supplier.data.name}` : 'Add a supplier'} />
      <form onSubmit={save} noValidate>
        <ParchmentCard title="About this supplier">
          <Field label="Name (required)" error={errors.name}>
            <TextInput required aria-required="true" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Website" hint="Starts with https://" error={errors.website}>
            <TextInput inputMode="url" value={form.website} onChange={e => set('website', e.target.value)} />
          </Field>
          <Field label="Contact notes" error={errors.contact}>
            <TextArea value={form.contact} onChange={e => set('contact', e.target.value)} />
          </Field>
          <Field label="Good for" error={errors.good_for}>
            <TextInput value={form.good_for} onChange={e => set('good_for', e.target.value)} />
          </Field>
          <Field label="Rating" error={errors.rating}>
            <Select value={form.rating} onChange={e => set('rating', e.target.value)} placeholder="Not rated" options={RATINGS} />
          </Field>
          <Field label="Notes" error={errors.notes}>
            <TextArea value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </ParchmentCard>
        <p className="page-actions">
          <WaxSeal type="submit">Save</WaxSeal>
          <Link to={editing ? `/cabinet/suppliers/${id}` : '/cabinet/suppliers'}>Cancel</Link>
        </p>
      </form>
    </>
  );
}
