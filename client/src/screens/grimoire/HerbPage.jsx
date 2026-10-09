import { Fragment } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { PhotoGallery } from '../../components/PhotoGallery.jsx';
import { Button } from '../../components/Button.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { useDeleteWithUndo } from '../../components/useDeleteWithUndo.jsx';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { formatAmount, formatDay, statusBadges, safeUrl } from '../../lib/cabinet.js';
import { AHPA_LABELS, CAUTION_FIELDS } from '../../lib/grimoire.js';

const cap = v => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
const list = v => (Array.isArray(v) ? v : []);

function Rows({ rows }) {
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0) return null;
  return (
    <dl className="dl-grid">
      {shown.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
    </dl>
  );
}

export function HerbPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const del = useDeleteWithUndo();
  const { data: herb, error, reload } = useApi(`/api/herbs/${id}?today=${todayString()}`);
  const sections = useApi('/api/sections');

  if (error) {
    return (
      <>
        <PageHeader title="Grimoire" />
        <p role="alert">{error.message}</p>
        <Button onClick={reload}>Try again</Button>
      </>
    );
  }
  if (!herb) return <><PageHeader title="Grimoire" /><p>Opening the page…</p></>;

  const herbSection = (sections.data ?? []).find(s => s.kind === 'herb');
  const cautions = CAUTION_FIELDS.filter(([f]) => herb[f]);
  const preparations = list(herb.preparations);
  const hasUses = herb.uses || preparations.length > 0 || herb.taste || herb.energetics;
  const zodiac = list(herb.zodiac);
  const associations = list(herb.associations);
  const hasCorr = herb.planet || herb.element || herb.gender || zodiac.length > 0 || associations.length > 0;
  const companions = list(herb.garden_companions);
  const hasGarden = herb.garden_harvest_part || herb.garden_harvest_timing || herb.garden_sun || herb.garden_water || companions.length > 0;
  const jars = list(herb.jars);
  const sources = list(herb.sources);
  const subtitle = [herb.latin_name, herb.family].filter(Boolean).join(', ');
  const addJar = herbSection ? `/cabinet/new?section=${herbSection.id}&herb=${herb.id}` : `/cabinet/new?herb=${herb.id}`;

  return (
    <>
      <PageHeader title={herb.common_name} subtitle={subtitle}
        actions={(
          <>
            <Button as={Link} variant="secondary" to={`/grimoire/${herb.id}/edit`}>Edit</Button>
            <Button variant="danger" onClick={async () => {
              if (await del({ url: `/api/herbs/${herb.id}`, label: herb.common_name, onUndo: () => navigate(`/grimoire/${herb.id}`) })) navigate('/grimoire');
            }}>Delete</Button>
          </>
        )} />
      <div className="card-grid">
        <ParchmentCard title="Before you use it" className="panel-caution panel-wide">
          {cautions.length === 0 && !herb.ahpa_class && (
            <p>No cautions recorded. That doesn't mean it's safe for everyone.</p>
          )}
          {cautions.length > 0 && (
            <dl className="dl-grid dl-cautions">
              {cautions.map(([f, label]) => <Fragment key={f}><dt>{label}</dt><dd>{herb[f]}</dd></Fragment>)}
            </dl>
          )}
          {herb.ahpa_class && AHPA_LABELS[herb.ahpa_class] && (
            <p><span className="badge badge-oxblood">{AHPA_LABELS[herb.ahpa_class]}</span></p>
          )}
          <p className="muted">For learning and folk tradition. Not medical advice; check with a qualified practitioner, especially if you're pregnant, nursing or take medicines.</p>
        </ParchmentCard>

        {hasUses && (
          <ParchmentCard title="Uses in tradition">
            {herb.uses && <p>{herb.uses}</p>}
            {preparations.length > 0 && <ul>{preparations.map(p => <li key={p}>{cap(p)}</li>)}</ul>}
            <Rows rows={[['Taste', herb.taste], ['Energetics', herb.energetics]]} />
          </ParchmentCard>
        )}

        {hasCorr && (
          <ParchmentCard title="Correspondences">
            <Rows rows={[
              ['Planet', herb.planet], ['Element', herb.element], ['Zodiac', zodiac.join(', ')],
              ['Gender', herb.gender], ['Associations', associations.join(', ')],
            ]} />
            <p className="muted">Folk tradition, not fact.</p>
          </ParchmentCard>
        )}

        {hasGarden && (
          <ParchmentCard title="In the garden">
            <Rows rows={[
              ['Part harvested', herb.garden_harvest_part], ['Harvest timing', herb.garden_harvest_timing],
              ['Sun', herb.garden_sun], ['Water', herb.garden_water], ['Grows well with', companions.join(', ')],
            ]} />
          </ParchmentCard>
        )}

        <ParchmentCard title="In your cabinet">
          {jars.length > 0 ? (
            <ul>
              {jars.map(j => (
                <li key={j.id}>
                  <Link to={`/cabinet/items/${j.id}`}>{j.name}</Link>{' '}
                  <span>{formatAmount(j.amount, j.unit)}</span>
                  {j.size_label && <span> ({j.size_label})</span>}
                  {j.expires_on && <span>, use by {formatDay(j.expires_on)}</span>}{' '}
                  {statusBadges(j.status).map(b => <span key={b.key} className={`badge badge-${b.tone}`}>{b.label}</span>)}
                </li>
              ))}
            </ul>
          ) : <p className="muted">No jar of this herb yet.</p>}
          <p><WaxSealLink to={addJar}>Add a jar of this herb</WaxSealLink></p>
        </ParchmentCard>

        {sources.length > 0 && (
          <ParchmentCard title="Sources">
            <ul>
              {sources.map(s => {
                const href = safeUrl(s.url);
                const meta = [s.author, s.year].filter(Boolean).join(', ');
                const covers = list(s.covers);
                return (
                  <li key={s.id}>
                    {href ? <a href={href} target="_blank" rel="noopener noreferrer">{s.title}</a> : <span>{s.title}</span>}
                    {meta && <span>, {meta}</span>}
                    {covers.length > 0 && <span className="muted"> Covers: {covers.join(', ')}</span>}
                  </li>
                );
              })}
            </ul>
          </ParchmentCard>
        )}

        <ParchmentCard title="Photos">
          <PhotoGallery ownerType="herb" ownerId={herb.id} photos={list(herb.photos)} onChange={reload} />
        </ParchmentCard>

        {herb.notes && (
          <ParchmentCard title="Notes"><p>{herb.notes}</p></ParchmentCard>
        )}
      </div>
    </>
  );
}
