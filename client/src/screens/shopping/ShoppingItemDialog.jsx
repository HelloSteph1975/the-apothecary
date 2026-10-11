import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, TextArea, Select } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';

const s = v => (v == null ? '' : String(v));
const orNull = v => (v.trim() === '' ? null : v.trim());
const toNum = v => (v === '' ? null : Number(v));

const startOf = item => ({
  name: s(item?.name), quantity: s(item?.quantity), notes: s(item?.notes),
  section_id: s(item?.section?.id), supplier_id: s(item?.supplier?.id), herb_id: s(item?.herb?.id), item_id: s(item?.item?.id),
});

// Live records for a select, plus the one she already linked even if it has since gone, so saving keeps it.
function optionsFor(list, label, link) {
  const options = list.map(x => ({ value: String(x.id), label: label(x) }));
  if (link && link.live === false && !options.some(o => o.value === String(link.id))) {
    options.push({ value: String(link.id), label: `${link.name} (no longer here)` });
  }
  return options;
}

const asList = data => (Array.isArray(data) ? data : []);

export function ShoppingItemDialog({ open, item, onClose, onSaved }) {
  const toast = useToast();
  const sections = useApi(open ? '/api/sections' : null);
  const suppliers = useApi(open ? '/api/suppliers' : null);
  const herbs = useApi(open ? '/api/herbs' : null);
  const jars = useApi(open ? `/api/items?today=${todayString()}` : null);
  const [form, setForm] = useState(() => startOf(item));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (open) { setForm(startOf(item)); setErrors({}); setFormError(''); }
    // Only on opening, so a refetch never wipes what she typed.
  }, [open]);

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setFormError('');
    if (!form.name.trim()) { setErrors({ name: 'Give the item a name.' }); return; }
    const body = {
      name: form.name.trim(), quantity: orNull(form.quantity), section_id: toNum(form.section_id), supplier_id: toNum(form.supplier_id),
      herb_id: toNum(form.herb_id), item_id: toNum(form.item_id), notes: orNull(form.notes),
    };
    setSaving(true);
    try {
      if (item) await api.patch(`/api/shopping/items/${item.id}`, body); else await api.post('/api/shopping/items', body);
      onSaved();
      onClose();
    } catch (ex) {
      const details = ex.details ?? {};
      setErrors(details);
      if (Object.keys(details).length === 0) setFormError(ex.message);
      else toast.show({ message: ex.message, duration: 6000 });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={item ? `Edit ${item.name}` : 'Add an item'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="shopping-item-form" disabled={saving}>Save</Button></>}>
      <form id="shopping-item-form" onSubmit={save} noValidate>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <Field label="Name (required)" error={errors.name}>
          <TextInput data-autofocus required aria-required="true" value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="Quantity" hint="For example 2 lb or a dozen" error={errors.quantity}>
          <TextInput value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </Field>
        <Field label="Section" error={errors.section_id}>
          <Select value={form.section_id} onChange={e => set('section_id', e.target.value)} placeholder="Not set"
            options={optionsFor(asList(sections.data), x => x.name, item?.section)} />
        </Field>
        <Field label="Supplier" error={errors.supplier_id}>
          <Select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} placeholder="Not set"
            options={optionsFor(asList(suppliers.data), x => x.name, item?.supplier)} />
        </Field>
        <Field label="Herb" error={errors.herb_id}>
          <Select value={form.herb_id} onChange={e => set('herb_id', e.target.value)} placeholder="Not linked"
            options={optionsFor(asList(herbs.data), x => x.common_name, item?.herb)} />
        </Field>
        <Field label="Jar" error={errors.item_id}>
          <Select value={form.item_id} onChange={e => set('item_id', e.target.value)} placeholder="Not linked"
            options={optionsFor(asList(jars.data), x => x.name, item?.item)} />
        </Field>
        <Field label="Notes" error={errors.notes}>
          <TextArea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
