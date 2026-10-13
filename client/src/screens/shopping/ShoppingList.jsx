import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { formatAmount, formatMoney, formatShortDay } from '../../lib/cabinet.js';
import { RestockDialog } from '../cabinet/RestockDialog.jsx';
import { ShoppingItemDialog } from './ShoppingItemDialog.jsx';

function lastText(last) {
  const who = last.supplier?.name;
  let text = who ? `Last from ${who}` : 'Last bought';
  if (last.price != null) text += who ? `, ${formatMoney(last.price)}` : ` ${formatMoney(last.price)}`;
  if (last.purchased_on) text += ` on ${formatShortDay(last.purchased_on)}`;
  return text;
}

function Row({ row, onCheck, onRestock, onEdit, onDelete }) {
  const low = row.kind === 'low';
  const jar = row.item?.live ? row.item : null;
  const need = low ? { used_up: row.used_up, amount: row.amount, unit: row.unit, low_threshold: row.low_threshold } : row.need;
  const restockButton = <Button variant="secondary" size="sm" onClick={() => onRestock(row)}>Restock</Button>;
  return (
    <li className={`shopping-row${row.checked ? ' shopping-checked' : ''}`}>
      <input type="checkbox" className="shopping-box" aria-label={row.name} checked={row.checked} onChange={() => onCheck(row)} />
      <div className="shopping-main">
        <p className="shopping-name">{jar ? <Link to={`/cabinet/items/${jar.id}`}>{row.name}</Link> : <span>{row.name}</span>}</p>
        {need && (need.used_up
          ? <p className="muted">Used up</p>
          : <p className="muted">{formatAmount(need.amount, need.unit)} left, low at {formatAmount(need.low_threshold, need.unit)}</p>)}
        {!low && row.quantity && <p className="muted">{row.quantity}</p>}
        {!low && row.notes && <p className="muted">{row.notes}</p>}
        {row.last && <p className="muted">{lastText(row.last)}</p>}
      </div>
      <div className="shopping-actions">
        {low
          ? restockButton
          : (
            <>
              {/* A row for a jar she already has refills that jar instead of starting a new one. */}
              {jar ? restockButton : <Button as={Link} variant="secondary" size="sm" to={`/cabinet/new?shopping=${row.id}`}>Bought</Button>}
              <Button variant="secondary" size="sm" icon={Pencil} aria-label={`Edit ${row.name}`} onClick={() => onEdit(row)} />
              <Button variant="secondary" size="sm" icon={Trash2} aria-label={`Delete ${row.name}`} onClick={() => onDelete(row)} />
            </>
          )}
      </div>
    </li>
  );
}

export function ShoppingList() {
  const [params] = useSearchParams();
  const group = params.get('group') === 'supplier' ? 'supplier' : 'section';
  const list = useApi(`/api/shopping?group=${group}`, { keepPrevious: true });
  const toast = useToast();
  const deleteWithUndo = useDeleteWithUndo();
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [restock, setRestock] = useState(null); // { item, open }; kept after closing so the dialog closes cleanly

  const clearingRef = useRef(false);
  const restockReq = useRef(0);

  const fail = err => toast.show({ message: err.message, duration: 6000 });

  async function check(row) {
    try {
      await api.post('/api/shopping/check', { key: row.key, checked: !row.checked });
      list.reload();
    } catch (err) { fail(err); list.reload(); }
  }

  async function clearChecked() {
    if (clearingRef.current) return;
    clearingRef.current = true;
    try {
      const res = await api.post('/api/shopping/clear');
      list.reload();
      if (!res.cleared) { toast.show({ message: 'Nothing of yours was checked' }); return; }
      toast.show({
        message: res.cleared === 1 ? 'Cleared 1 checked item' : `Cleared ${res.cleared} checked items`,
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.post('/api/shopping/clear/undo', { stamp: res.stamp });
              list.reload();
              toast.show({ message: 'Brought them back' });
            } catch (err) { fail(err); }
          },
        },
      });
    } catch (err) { fail(err); } finally { clearingRef.current = false; }
  }

  // The restock form needs the jar's last supplier and form, which the list row doesn't carry.
  async function openRestock(row) {
    const mine = ++restockReq.current;
    try {
      const item = await api.get(`/api/items/${row.item.id}?today=${todayString()}`);
      if (mine === restockReq.current) setRestock({ item, open: true });
    } catch (err) { if (mine === restockReq.current) fail(err); }
  }

  const header = (
    <PageHeader title="Shopping list" subtitle="What the cabinet is running low on"
      actions={(
        <>
          <WaxSeal onClick={() => setDialog({ open: true, item: null })}>Add an item</WaxSeal>
          <Button variant="secondary" disabled={!list.data?.counts.checked_items} onClick={clearChecked}>Clear checked</Button>
        </>
      )} />
  );
  const tabLink = (value, label) => (
    <Link className="tab" to={value === 'section' ? '?' : `?group=${value}`} replace aria-current={group === value ? 'page' : undefined}>{label}</Link>
  );
  const toggle = <nav className="tabs" aria-label="Group by">{tabLink('section', 'Section')}{tabLink('supplier', 'Supplier')}</nav>;

  let body;
  if (list.error) body = <><p role="alert">{list.error.message}</p><Button onClick={list.reload}>Try again</Button></>;
  else if (!list.data) body = <p role="status">Opening the list…</p>;
  else if (list.data.groups.length === 0) {
    body = <ParchmentCard botanical="calendula"><p className="muted">Nothing to buy. Jars running low will show up here.</p></ParchmentCard>;
  } else {
    body = (
      <div className="card-grid">
        {list.data.groups.map(g => (
          <ParchmentCard key={g.key} title={g.name}>
            <ul className="shopping-rows">
              {g.rows.map(r => (
                <Row key={r.key} row={r} onCheck={check} onRestock={openRestock}
                  onEdit={x => setDialog({ open: true, item: x })}
                  onDelete={x => deleteWithUndo({ url: `/api/shopping/items/${x.id}`, label: x.name, onChange: list.reload })} />
              ))}
            </ul>
          </ParchmentCard>
        ))}
      </div>
    );
  }

  return (
    <>
      {header}
      {toggle}
      {body}
      <ShoppingItemDialog open={dialog.open} item={dialog.item} onClose={() => setDialog(d => ({ ...d, open: false }))} onSaved={list.reload} />
      {restock && (
        <RestockDialog item={restock.item} open={restock.open} onClose={() => setRestock(r => ({ ...r, open: false }))} onDone={list.reload} />
      )}
    </>
  );
}
