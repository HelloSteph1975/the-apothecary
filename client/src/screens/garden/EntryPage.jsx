import { Fragment } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useApi } from '../../lib/useApi.js';
import { formatAmount, formatDay } from '../../lib/cabinet.js';
import { FORAGING_NOTE, skyText } from '../../lib/garden.js';

export function GardenEntryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const del = useDeleteWithUndo();
  const { data: entry, error, reload } = useApi(`/api/garden/entries/${id}`);

  if (error) {
    return (
      <>
        <PageHeader title="Garden log" />
        <p role="alert">{error.message}</p>
        <Button onClick={reload}>Try again</Button>
        <p><Link to="/garden/log">Back to the log</Link></p>
      </>
    );
  }
  if (!entry) return <><PageHeader title="Garden log" /><p role="status">Opening the entry…</p></>;

  const sky = skyText(entry.sky);
  const harvest = entry.kind === 'harvested' || entry.kind === 'foraged';
  const jar = entry.item?.live ? entry.item : null;
  const plantName = entry.plant?.name ?? entry.plant_name;
  const rows = [
    ['Plant', entry.plant
      ? (entry.plant.live ? <Link to={`/garden/plants/${entry.plant.id}`}>{plantName}</Link> : <><span className="muted">{plantName}</span> <span className="muted">(no longer here)</span></>)
      : entry.plant_name],
    ['Place', entry.place],
    ['Amount', entry.amount != null && formatAmount(entry.amount, entry.unit)],
    ['Weather', entry.weather],
  ].filter(([, v]) => v);

  return (
    <>
      <PageHeader title={entry.title} subtitle={formatDay(entry.entry_date)}
        actions={(
          <>
            <Button as={Link} variant="secondary" to={`/garden/entries/${entry.id}/edit`}>Edit</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/garden/entries/${entry.id}`, label: entry.title, onUndo: () => navigate(`/garden/entries/${entry.id}`) })) navigate('/garden/log');
            }}>Delete</Button>
          </>
        )} />
      {entry.kind === 'foraged' && <ParchmentCard title="Before you forage"><p>{FORAGING_NOTE}</p></ParchmentCard>}
      <div className="card-grid">
        <ParchmentCard title="What happened">
          <dl className="dl-grid">
            {rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
          </dl>
          {sky && <p>{`The moon that day: ${sky}`}</p>}
          {entry.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{entry.notes}</p>}
        </ParchmentCard>
        {harvest && (
          <ParchmentCard title="In the cabinet">
            {jar
              ? <p>Jar: <Link to={`/cabinet/items/${jar.id}`}>{jar.name}</Link></p>
              : <p><Button as={Link} variant="secondary" to={`/cabinet/new?garden_entry=${entry.id}`}>Send to the cabinet</Button></p>}
          </ParchmentCard>
        )}
        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="garden_entry" ownerId={entry.id} photos={entry.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
    </>
  );
}
