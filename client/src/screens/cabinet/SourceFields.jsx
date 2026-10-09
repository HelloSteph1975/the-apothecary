import { useState } from 'react';
import { Field, TextInput, NumberInput, DateInput, Select } from '../../components/Field.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { api } from '../../lib/api.js';
import { todayString } from '../../lib/today.js';
import { SOURCE_KINDS } from '../../lib/cabinet.js';

const ADD = '__add__';

export function SourceFields({ form, set, err, suppliers, onSupplierAdded, editing }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const kind = form.source_kind;
  const bought = kind === 'bought';

  function pickSupplier(value) {
    if (value === ADD) { setAdding(true); return; }
    setAdding(false);
    set('supplier_id', value);
  }

  async function addSupplier() {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await api.post('/api/suppliers', { name });
      onSupplierAdded(created);
      set('supplier_id', String(created.id));
      setNewName('');
      setAdding(false);
    } catch (e) {
      toast.show({ message: e.message, duration: 6000 });
    }
  }

  return (
    <>
      <Field label="Source" error={err('source_kind')}>
        <Select value={form.source_kind} onChange={e => {
          set('source_kind', e.target.value);
          if (!editing && e.target.value === 'bought' && !form.acquired_on) set('acquired_on', todayString());
        }}
          placeholder="Not recorded" options={SOURCE_KINDS} />
      </Field>
      {bought && !editing && (
        <>
          <Field label="Supplier" error={err('supplier_id')}>
            <Select value={adding ? ADD : form.supplier_id} onChange={e => pickSupplier(e.target.value)} placeholder="No supplier"
              options={[...suppliers.map(s => ({ value: String(s.id), label: s.name })), { value: ADD, label: 'Add a supplier…' }]} />
          </Field>
          {adding && (
            <>
              <Field label="New supplier name">
                <TextInput value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSupplier(); } }} />
              </Field>
              <p><Button variant="secondary" size="sm" onClick={addSupplier}>Add this supplier</Button></p>
            </>
          )}
          <Field label="Price" error={err('price')}>
            <NumberInput min="0" value={form.price} onChange={e => set('price', e.target.value)} />
          </Field>
          <Field label="Order note" error={err('order_note')}>
            <TextInput value={form.order_note} onChange={e => set('order_note', e.target.value)} />
          </Field>
        </>
      )}
      {kind === 'foraged' && (
        <Field label="Place" error={err('source_place')}>
          <TextInput value={form.source_place} onChange={e => set('source_place', e.target.value)} />
        </Field>
      )}
      {kind === 'gifted' && (
        <Field label="From whom" error={err('source_from')}>
          <TextInput value={form.source_from} onChange={e => set('source_from', e.target.value)} />
        </Field>
      )}
      {kind && (
        <Field label={bought ? 'Date bought' : 'Date harvested or made'} error={err('acquired_on') || err('purchased_on')}>
          <DateInput value={form.acquired_on} onChange={e => set('acquired_on', e.target.value)} />
        </Field>
      )}
    </>
  );
}
