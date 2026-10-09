import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, NumberInput, DateInput, Select } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { UNITS } from '../../lib/cabinet.js';

const toNum = v => (v === '' || v == null ? null : Number(v));
const blank = item => ({
  quantity: '', supplier_id: '', price: '',
  purchased_on: todayString(), expires_on: '', order_note: '',
});

export function RestockDialog({ item, open, onClose, onDone }) {
  const toast = useToast();
  const suppliers = useApi(open ? '/api/suppliers' : null);
  const [form, setForm] = useState(() => blank(item));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const typedExpiry = useRef(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  useEffect(() => {
    if (open) { setForm(blank(item)); setErrors({}); typedExpiry.current = false; }
    // Start fresh each time the dialog opens, not on every refetch of the item.
  }, [open]);

  // Default to the last supplier only if it is still in the list.
  useEffect(() => {
    const last = item.last_supplier_id;
    if (!open || !last || !suppliers.data) return;
    if (suppliers.data.some(x => x.id === last)) setForm(f => (f.supplier_id ? f : { ...f, supplier_id: String(last) }));
  }, [open, suppliers.data, item.last_supplier_id]);

  // Offer a new use by date from the form; she can change or clear it.
  useEffect(() => {
    if (!open || !item.form || !form.purchased_on) return undefined;
    let live = true;
    api.get(`/api/expiry-suggestion?form=${encodeURIComponent(item.form)}&acquired_on=${encodeURIComponent(form.purchased_on)}`)
      .then(r => { if (live && r?.expires_on && !typedExpiry.current) setForm(f => ({ ...f, expires_on: r.expires_on })); }, () => {});
    return () => { live = false; };
  }, [open, item.form, form.purchased_on]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/items/${item.id}/restock`, {
        quantity: toNum(form.quantity), supplier_id: toNum(form.supplier_id), price: toNum(form.price),
        purchased_on: form.purchased_on || null, order_note: form.order_note || null, expires_on: form.expires_on || null,
      });
      onClose();
      onDone();
      toast.show({ message: 'Restocked' });
    } catch (err) {
      setErrors(err.details ?? {});
      toast.show({ message: err.message, duration: 6000 });
    } finally { setBusy(false); }
  }

  const unit = UNITS.find(u => u.value === item.unit)?.label ?? item.unit;
  return (
    <Dialog open={open} onClose={onClose} title={`Restock ${item.name}`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="restock-form" disabled={busy}>Restock</Button>
        </>
      )}>
      <form id="restock-form" onSubmit={submit} noValidate>
        <Field label="Quantity" hint={`In ${unit}`} error={errors.quantity}>
          <NumberInput min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} data-autofocus="" />
        </Field>
        <Field label="Supplier" error={errors.supplier_id}>
          <Select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} placeholder="No supplier"
            options={(suppliers.data ?? []).map(s => ({ value: String(s.id), label: s.name }))} />
        </Field>
        <Field label="Price" error={errors.price}>
          <NumberInput min="0" value={form.price} onChange={e => set('price', e.target.value)} />
        </Field>
        <Field label="Date" error={errors.purchased_on}>
          <DateInput value={form.purchased_on} onChange={e => set('purchased_on', e.target.value)} />
        </Field>
        <Field label="New use by" hint="Optional" error={errors.expires_on}>
          <DateInput value={form.expires_on} onChange={e => { typedExpiry.current = true; set('expires_on', e.target.value); }} />
        </Field>
        <Field label="Order note" error={errors.order_note}>
          <TextInput value={form.order_note} onChange={e => set('order_note', e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
