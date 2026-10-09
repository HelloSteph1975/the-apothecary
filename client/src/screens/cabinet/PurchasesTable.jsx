import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { TextInput, NumberInput, DateInput } from '../../components/Field.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { formatAmount, formatMoney } from '../../lib/cabinet.js';

function EditRow({ p, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ purchased_on: p.purchased_on ?? '', price: p.price ?? '', order_note: p.order_note ?? '' });
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  async function save() {
    try {
      await api.patch(`/api/purchases/${p.id}`, {
        purchased_on: f.purchased_on || null, price: f.price === '' ? null : Number(f.price), order_note: f.order_note || null,
      });
      onDone(true);
    } catch (e) { toast.show({ message: e.message, duration: 6000 }); }
  }
  return (
    <tr>
      <td><DateInput ref={first} aria-label="Date" value={f.purchased_on} onChange={e => set('purchased_on', e.target.value)} /></td>
      <td>{p.supplier_name || 'No supplier'}{p.supplier_deleted_at && ' (removed)'}</td>
      <td>{formatAmount(p.quantity, p.unit)}</td>
      <td><NumberInput aria-label="Price" min="0" value={f.price} onChange={e => set('price', e.target.value)} /></td>
      <td><TextInput aria-label="Note" value={f.order_note} onChange={e => set('order_note', e.target.value)} /></td>
      <td>
        <Button size="sm" onClick={save}>Save</Button>{' '}
        <Button size="sm" variant="ghost" onClick={() => onDone(false)}>Cancel</Button>
      </td>
    </tr>
  );
}

export function PurchasesTable({ purchases, onChange }) {
  const [editing, setEditing] = useState(null);
  const [refocus, setRefocus] = useState(null);
  const editButtons = useRef({});
  // After an inline edit closes, hand focus back to that row's Edit button.
  useEffect(() => {
    if (refocus != null && editing == null) { editButtons.current[refocus]?.focus(); setRefocus(null); }
  }, [refocus, editing]);
  const del = useDeleteWithUndo();
  if (purchases.length === 0) return <p className="muted">No purchases recorded.</p>;
  return (
    <div className="table-wrap">
      <table className="purchase-table">
        <thead>
          <tr><th>Date</th><th>Supplier</th><th>Quantity</th><th>Price</th><th>Note</th><th><span className="visually-hidden">Actions</span></th></tr>
        </thead>
        <tbody>
          {purchases.map(p => (editing === p.id ? <EditRow key={p.id} p={p} onDone={changed => { setEditing(null); setRefocus(p.id); if (changed) onChange(); }} /> : (
            <tr key={p.id}>
              <td>{p.purchased_on}</td>
              <td>
                {p.supplier_id ? <Link to={`/cabinet/suppliers/${p.supplier_id}`}>{p.supplier_name}</Link> : 'Not recorded'}
                {p.supplier_deleted_at && ' (removed)'}
              </td>
              <td>{formatAmount(p.quantity, p.unit)}</td>
              <td>{formatMoney(p.price)}</td>
              <td>{p.order_note}</td>
              <td>
                <Button ref={el => { editButtons.current[p.id] = el; }} size="sm" variant="ghost" aria-label={`Edit purchase from ${p.purchased_on}`} onClick={() => setEditing(p.id)}>Edit</Button>{' '}
                <Button size="sm" variant="ghost" aria-label={`Delete purchase from ${p.purchased_on}`}
                  onClick={() => del({ url: `/api/purchases/${p.id}`, label: 'this purchase', onChange })}>Delete</Button>
              </td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}
