import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { useApi } from '../../lib/useApi.js';
import { Toolbar } from './Toolbar.jsx';

const FILTERS = ['q', 'part', 'planet', 'element', 'has_jars', 'caution'];

function Glyph() {
  return (
    <svg className="herb-glyph" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 42 V20" />
      <path d="M24 30 C16 30 11 24 11 16 C19 16 24 21 24 30 Z" />
      <path d="M24 24 C24 15 29 10 37 10 C37 18 32 24 24 24 Z" />
    </svg>
  );
}

function HerbCard({ herb }) {
  const traits = [herb.planet, herb.element].filter(Boolean).join(', ');
  return (
    <ParchmentCard className="herb-card">
      <div className="herb-card-head">
        {herb.cover ? <img className="herb-cover" src={`/photos/${herb.cover}`} alt="" /> : <Glyph />}
        <div>
          <h2><Link to={`/grimoire/${herb.id}`}>{herb.common_name}</Link></h2>
          {herb.latin_name && <p><em>{herb.latin_name}</em></p>}
        </div>
      </div>
      {traits && <p className="muted">{traits}</p>}
      {(herb.has_cautions || herb.jar_count > 0) && (
        <span className="badges">
          {herb.has_cautions && <span className="badge badge-oxblood">Cautions</span>}
          {herb.jar_count > 0 && (
            <span className="badge badge-brass">In your cabinet ({herb.jar_count} {herb.jar_count === 1 ? 'jar' : 'jars'})</span>
          )}
        </span>
      )}
    </ParchmentCard>
  );
}

export function Grimoire() {
  const [params, setParams] = useSearchParams();
  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  }, [setParams]);

  const query = new URLSearchParams();
  FILTERS.forEach(k => { if (params.get(k)) query.set(k, params.get(k)); });
  const herbs = useApi(`/api/herbs?${query}`, { keepPrevious: true });
  const filtered = FILTERS.some(k => params.get(k));

  const header = (
    <>
      <PageHeader title="Grimoire" subtitle="Herbs, their ways and their cautions" actions={<WaxSealLink to="/grimoire/new">Add an herb</WaxSealLink>} />
      <p className="muted">For learning and folk tradition. Not medical advice; check with a qualified practitioner, especially if you're pregnant, nursing or take medicines.</p>
    </>
  );

  if (herbs.error) {
    return (
      <>{header}
        <Toolbar params={params} setParam={setParam} />
        <p role="alert">{herbs.error.message}</p>
        <Button onClick={herbs.reload}>Try again</Button>
      </>
    );
  }
  if (!herbs.data) return <>{header}<p>Opening the grimoire…</p></>;

  return (
    <>
      {header}
      <Toolbar params={params} setParam={setParam} />
      {herbs.data.length === 0 ? (
        filtered ? (
          <ParchmentCard title="No herbs match."><p className="muted">Try fewer filters.</p></ParchmentCard>
        ) : (
          <ParchmentCard title="The grimoire is empty" botanical="chamomile">
            <p><Link to="/grimoire/new">Add an herb</Link></p>
          </ParchmentCard>
        )
      ) : (
        <div className="card-grid">{herbs.data.map(h => <HerbCard key={h.id} herb={h} />)}</div>
      )}
    </>
  );
}
