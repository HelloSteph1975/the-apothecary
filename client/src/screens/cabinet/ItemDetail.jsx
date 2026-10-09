import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { CabinetTabs } from '../../components/CabinetTabs.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { WaxSeal } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { formatAmount, formatDay, statusBadges, sourceText } from '../../lib/cabinet.js';
import { RestockDialog } from './RestockDialog.jsx';
import { PurchasesTable } from './PurchasesTable.jsx';

const cap = v => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

export function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const del = useDeleteWithUndo();
  const [restocking, setRestocking] = useState(false);
  const { data: item, error, reload } = useApi(`/api/items/${id}?today=${todayString()}`);

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
  if (!item) return <><PageHeader title="Herb cabinet" /><CabinetTabs /><p>Opening the jar…</p></>;

  const usedUp = Boolean(item.used_up_at);
  const badges = statusBadges(item.status);
  if (usedUp) badges.push({ key: 'used_up', label: 'Used up', tone: 'brass' });
  const source = sourceText(item);

  async function toggleUsedUp() {
    try {
      await api.patch(`/api/items/${item.id}`, { used_up: !usedUp });
      reload();
    } catch (e) { toast.show({ message: e.message, duration: 6000 }); }
  }

  return (
    <>
      <PageHeader title={item.name} subtitle={item.latin_name || item.section_name}
        actions={(
          <>
            <WaxSeal onClick={() => setRestocking(true)}>Restock</WaxSeal>
            <Button as={Link} variant="secondary" to={`/cabinet/items/${item.id}/edit`}>Edit</Button>
            <Button variant="secondary" onClick={toggleUsedUp}>{usedUp ? 'Put back' : 'Mark used up'}</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/items/${item.id}`, label: item.name, onUndo: () => navigate(`/cabinet/items/${item.id}`) })) navigate('/cabinet');
            }}>Delete</Button>
          </>
        )} />
      <CabinetTabs />
      <div className="card-grid">
        <ParchmentCard title="In the jar">
          {badges.length > 0 && (
            <p className="badges">
              {badges.map(b => <span key={b.key} className={`badge badge-${b.tone}`}>{b.label}</span>)}
            </p>
          )}
          <dl className="dl-grid">
            <dt>Amount</dt><dd>{formatAmount(item.amount, item.unit)}</dd>
            {item.size_label && <><dt>Size</dt><dd>{item.size_label}</dd></>}
            {item.low_threshold != null && <><dt>Low reminder</dt><dd>Reminds you at {formatAmount(item.low_threshold, item.unit)}</dd></>}
            {item.expires_on && <><dt>Use by</dt><dd>{formatDay(item.expires_on)}</dd></>}
            {item.storage_spot && <><dt>Stored</dt><dd>{item.storage_spot}</dd></>}
            {item.section_kind === 'herb' && item.form && <><dt>Form</dt><dd>{cap(item.form)}</dd></>}
            {item.section_kind === 'herb' && item.plant_part && <><dt>Plant part</dt><dd>{cap(item.plant_part)}</dd></>}
            {source && <><dt>Source</dt><dd>{source}</dd></>}
            {item.notes && <><dt>Notes</dt><dd>{item.notes}</dd></>}
          </dl>
        </ParchmentCard>
        <ParchmentCard title="Purchases">
          <PurchasesTable purchases={item.purchases ?? []} onChange={reload} />
        </ParchmentCard>
        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="item" ownerId={item.id} photos={item.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
      <RestockDialog item={item} open={restocking} onClose={() => setRestocking(false)} onDone={reload} />
    </>
  );
}
