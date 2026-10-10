import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput } from '../../components/Field.jsx';
import { useApi } from '../../lib/useApi.js';
import { formatDay } from '../../lib/cabinet.js';
import { nextStepText, isOverdue } from '../../lib/batches.js';
import { todayString } from '../../lib/today.js';

function BatchCard({ batch, today }) {
  const what = [batch.recipe_name, batch.type_name].filter(Boolean).join(', ');
  const step = batch.next_step;
  return (
    <ParchmentCard className="herb-card batch-card">
      <div className="herb-card-head">
        {batch.cover && <img className="herb-cover" src={`/photos/${batch.cover}`} alt="" />}
        <div>
          <h2><Link to={`/batches/${batch.id}`}>{batch.name}</Link></h2>
          {what && <p className="muted">{what}</p>}
        </div>
      </div>
      <p>Started {formatDay(batch.start_date)}</p>
      {batch.finished_on ? <p>Finished {formatDay(batch.finished_on)}</p> : step ? (
        <p>
          {nextStepText(step)}
          {isOverdue(step, today) && <> <span className="badge badge-oxblood">Overdue</span></>}
        </p>
      ) : <p className="muted">Ready to finish</p>}
    </ParchmentCard>
  );
}

export function BatchJournal() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') === 'finished' ? 'finished' : 'active';
  const urlQ = params.get('q') || '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);
  useEffect(() => {
    if (q === urlQ) return undefined;
    const t = setTimeout(() => setParam('q', q), 250);
    return () => clearTimeout(t);
  }, [q, urlQ, setParam]);

  const query = new URLSearchParams({ status });
  if (urlQ) query.set('q', urlQ);
  const batches = useApi(`/api/batches?${query}`, { keepPrevious: true });
  const today = todayString();

  const header = (
    <PageHeader title="Batch journal" subtitle="What you've made, and what's still steeping"
      actions={<WaxSealLink to="/batches/new">Start a batch</WaxSealLink>} />
  );
  const tabLink = (value, label) => {
    const next = new URLSearchParams(params);
    if (value === 'active') next.delete('status'); else next.set('status', value);
    const qs = next.toString();
    return (
      <Link className="tab" to={qs ? `?${qs}` : '?'} replace aria-current={status === value ? 'page' : undefined}>{label}</Link>
    );
  };
  const tabs = <nav className="tabs" aria-label="Batch status">{tabLink('active', 'Steeping')}{tabLink('finished', 'Finished')}</nav>;
  const toolbar = (
    <div className="toolbar" role="search">
      <Field label="Search"><TextInput type="search" placeholder="Oil, salve, calendula…" value={q} onChange={e => setQ(e.target.value)} /></Field>
    </div>
  );

  if (batches.error) {
    return (
      <>{header}{tabs}{toolbar}
        <p role="alert">{batches.error.message}</p>
        <Button onClick={batches.reload}>Try again</Button>
      </>
    );
  }
  if (!batches.data) return <>{header}<p>Opening the journal…</p></>;

  return (
    <>
      {header}
      {tabs}
      {toolbar}
      {batches.data.length === 0 ? (
        <ParchmentCard botanical="calendula">
          <p className="muted">
            {urlQ ? 'No batches match. Try a different search.'
              : status === 'active' ? 'Nothing steeping. Start a batch from a recipe.' : 'No finished batches yet.'}
          </p>
        </ParchmentCard>
      ) : (
        <div className="card-grid">{batches.data.map(b => <BatchCard key={b.id} batch={b} today={today} />)}</div>
      )}
    </>
  );
}
