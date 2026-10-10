import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useApi } from '../../lib/useApi.js';
import { MOODS, entryWhen, skyStampText } from '../../lib/journal.jsx';

export const LINK_PATHS = { herb: 'grimoire', recipe: 'recipes', batch: 'batches' };
export const LINK_LABELS = { herb: 'Herb', recipe: 'Recipe', batch: 'Batch' };

export function EntryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const del = useDeleteWithUndo();
  const { data: entry, error, reload } = useApi(`/api/journal/${id}`);

  if (error) {
    return (
      <>
        <PageHeader title="Journal" />
        <p role="alert">{error.message}</p>
        <Button onClick={reload}>Try again</Button>
        <p><Link to="/journal">Back to the journal</Link></p>
      </>
    );
  }
  if (!entry) return <><PageHeader title="Journal" /><p role="status">Opening the entry…</p></>;

  const sky = skyStampText(entry.sky, entry.entry_date);
  const mood = MOODS.find(m => m.value === entry.mood);
  const subtitle = [entry.type?.name, entryWhen(entry.entry_date, entry.entry_time)].filter(Boolean).join(', ');

  return (
    <>
      <PageHeader title={entry.title} subtitle={subtitle}
        actions={(
          <>
            <Button as={Link} variant="secondary" to={`/journal/${entry.id}/edit`}>Edit</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/journal/${entry.id}`, label: entry.title, onUndo: () => navigate(`/journal/${entry.id}`) })) navigate('/journal');
            }}>Delete</Button>
          </>
        )} />
      <div className="card-grid">
        {sky && (
          <ParchmentCard title="The sky that day">
            <p>{sky}</p>
          </ParchmentCard>
        )}
        <ParchmentCard title="Entry" className="panel-wide">
          {entry.body ? <p style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p> : <p className="muted">No words in this entry.</p>}
          {mood && <p><span className="muted">Mood: </span>{mood.label}</p>}
          {entry.tags.length > 0 && (
            <p className="chip-row">
              {entry.tags.map(t => <Link key={t} className="badge badge-brass" to={`/journal?view=tag&tag=${encodeURIComponent(t)}`}>{t}</Link>)}
            </p>
          )}
        </ParchmentCard>
        {entry.links.length > 0 && (
          <ParchmentCard title="Linked">
            <ul>
              {entry.links.map(l => (
                <li key={`${l.type}-${l.id}`}>
                  <span className="muted">{LINK_LABELS[l.type]}: </span>
                  {l.live ? <Link to={`/${LINK_PATHS[l.type]}/${l.id}`}>{l.name}</Link> : <><span className="muted">{l.name ?? LINK_LABELS[l.type]}</span> <span className="muted">(no longer here)</span></>}
                </li>
              ))}
            </ul>
          </ParchmentCard>
        )}
        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="journal" ownerId={entry.id} photos={entry.photos ?? []} onChange={reload} />
        </ParchmentCard>
      </div>
    </>
  );
}
