import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { CabinetTabs } from '../../components/CabinetTabs.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useApi } from '../../lib/useApi.js';
import { formatAmount, formatMoney, formatDay, safeUrl } from '../../lib/cabinet.js';
import { Stars } from './Stars.jsx';

export function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const del = useDeleteWithUndo();
  const { data: sup, error, reload } = useApi(`/api/suppliers/${id}`);

  if (error) {
    return (
      <>
        <PageHeader title="Herb cabinet" />
        <CabinetTabs />
        <p role="alert">{error.message}</p>
        <Button onClick={reload}>Try again</Button>
      </>
    );
  }
  if (!sup) return <><PageHeader title="Herb cabinet" /><CabinetTabs /><p>Opening the ledger…</p></>;

  const purchases = sup.purchases ?? [];
  const total = purchases.reduce((sum, p) => sum + (p.price ?? 0), 0);

  return (
    <>
      <PageHeader title={sup.name}
        actions={(
          <>
            <Button as={Link} variant="secondary" to={`/cabinet/suppliers/${sup.id}/edit`}>Edit</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/suppliers/${sup.id}`, label: sup.name, onUndo: () => navigate(`/cabinet/suppliers/${sup.id}`) })) navigate('/cabinet/suppliers');
            }}>Delete</Button>
          </>
        )} />
      <CabinetTabs />
      <div className="card-grid">
        <ParchmentCard title="About this supplier">
          <dl className="dl-grid">
            <dt>Rating</dt><dd><Stars rating={sup.rating} /></dd>
            {sup.good_for && <><dt>Good for</dt><dd>{sup.good_for}</dd></>}
            {safeUrl(sup.website) && <><dt>Website</dt><dd><a href={safeUrl(sup.website)} target="_blank" rel="noopener noreferrer">{safeUrl(sup.website)}</a></dd></>}
            {sup.contact && <><dt>Contact</dt><dd>{sup.contact}</dd></>}
            {sup.notes && <><dt>Notes</dt><dd>{sup.notes}</dd></>}
          </dl>
        </ParchmentCard>
        <ParchmentCard title="Bought here">
          {purchases.length === 0 ? <p className="muted">No purchases yet.</p> : (
            <div className="table-wrap">
              <table className="purchase-table">
                <thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Price</th></tr></thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id}>
                      <td>{formatDay(p.purchased_on)}</td>
                      <td><Link to={`/cabinet/items/${p.item_id}`}>{p.item_name}</Link></td>
                      <td>{formatAmount(p.quantity, p.unit)}</td>
                      <td>{formatMoney(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th colSpan={3} scope="row">Total spent</th><td>{formatMoney(total)}</td></tr></tfoot>
              </table>
            </div>
          )}
          <p><Link to={`/cabinet?supplier_id=${sup.id}`}>Show only these items on the shelves</Link></p>
        </ParchmentCard>
        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="supplier" ownerId={sup.id} photos={sup.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
    </>
  );
}
