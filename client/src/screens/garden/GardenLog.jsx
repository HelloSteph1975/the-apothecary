import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, DateInput, Select } from '../../components/Field.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { formatAmount, formatShortDay } from '../../lib/cabinet.js';
import { GARDEN_KINDS, KIND_ICON, kindLabel, skyTextCap } from '../../lib/garden.js';

const FILTERS = ['kind', 'plant_id', 'from', 'to'];

const queryOf = pairs => {
  const qs = new URLSearchParams();
  Object.entries(pairs).forEach(([k, v]) => { if (v) qs.set(k, v); });
  return qs.toString();
};
const urlOf = (qs, page) => {
  const all = [qs, page > 1 ? `page=${page}` : ''].filter(Boolean).join('&');
  return `/api/garden/entries${all ? `?${all}` : ''}`;
};

// Entries for one query, a page at a time: the first page comes from useApi, "More entries" appends the rest.
function useEntries(qs) {
  const first = useApi(urlOf(qs, 1), { keepPrevious: true });
  const fresh = { qs, pages: [], page: 1, error: null, busy: false };
  const [more, setMore] = useState(fresh);
  const current = more.qs === qs ? more : fresh;
  // Every reset bumps the generation, so a page requested before it can't land in the new list.
  const generation = useRef(0);
  useEffect(() => { generation.current += 1; setMore({ qs, pages: [], page: 1, error: null, busy: false }); }, [qs, first.data]);
  const entries = first.data ? [...first.data.entries, ...current.pages] : [];
  const total = first.data?.total ?? 0;
  const loadMore = async () => {
    if (first.loading) return;
    const page = current.page + 1;
    const mine = generation.current;
    setMore({ ...current, busy: true, error: null });
    try {
      const res = await api.get(urlOf(qs, page));
      setMore(m => (m.qs === qs && mine === generation.current ? { ...m, pages: [...m.pages, ...res.entries], page, busy: false } : m));
    } catch (err) {
      setMore(m => (m.qs === qs && mine === generation.current ? { ...m, busy: false, error: err } : m));
    }
  };
  const settled = Boolean(first.data) && !first.loading;
  return { first, entries, hasMore: settled && entries.length < total, loadMore, busy: current.busy, moreError: current.error };
}

function LogRow({ entry }) {
  const Icon = KIND_ICON[entry.kind];
  return (
    <tr>
      <td>{formatShortDay(entry.entry_date)}</td>
      <td>{Icon && <Icon size={16} aria-hidden="true" />} <span>{kindLabel(entry.kind)}</span></td>
      <td><Link to={`/garden/entries/${entry.id}`}>{entry.title}</Link></td>
      <td>{entry.place}</td>
      <td>{entry.amount != null && formatAmount(entry.amount, entry.unit)}</td>
      <td>{entry.weather}</td>
      <td>{skyTextCap(entry.sky)}</td>
      <td>{entry.cover && <img className="log-cover" src={`/photos/${entry.cover}`} alt="" width="40" height="40" />}</td>
    </tr>
  );
}

export function GardenLog() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTERS.map(k => [k, params.get(k) || '']));
  const plants = useApi('/api/garden/plants?status=all');
  const setFilter = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);
  const qs = queryOf(filters);
  const { first, entries, hasMore, loadMore, busy, moreError } = useEntries(qs);
  const filtered = Boolean(qs);

  const header = <PageHeader title="The whole log" subtitle="Everything you did in the garden"
    actions={<><Link to="/garden">Back to the garden</Link><WaxSealLink to="/garden/entries/new">Log something</WaxSealLink></>} />;
  const toolbar = (
    <div className="toolbar" role="search">
      <Field label="Kind">
        <Select value={filters.kind} onChange={e => setFilter('kind', e.target.value)} placeholder="All kinds" options={GARDEN_KINDS} />
      </Field>
      <Field label="Plant">
        <Select value={filters.plant_id} onChange={e => setFilter('plant_id', e.target.value)} placeholder="All plants"
          options={(Array.isArray(plants.data) ? plants.data : []).map(p => ({ value: String(p.id), label: p.name }))} />
      </Field>
      <Field label="From"><DateInput value={filters.from} onChange={e => setFilter('from', e.target.value)} /></Field>
      <Field label="To"><DateInput value={filters.to} onChange={e => setFilter('to', e.target.value)} /></Field>
    </div>
  );

  let body;
  if (first.error) body = <><p role="alert">{first.error.message}</p><Button onClick={first.reload}>Try again</Button></>;
  else if (!first.data) body = <p role="status">Opening the log…</p>;
  else if (entries.length === 0) {
    body = filtered
      ? <ParchmentCard title="No entries match."><p className="muted">Try different filters.</p></ParchmentCard>
      : <ParchmentCard title="The log is empty." botanical="calendula"><p><Link to="/garden/entries/new">Log the first thing you did.</Link></p></ParchmentCard>;
  } else {
    body = (
      <div className="table-wrap">
        <table className="purchase-table">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Kind</th><th scope="col">Entry</th><th scope="col">Place</th><th scope="col">Amount</th><th scope="col">Weather</th><th scope="col">Sky</th><th scope="col">Photo</th></tr>
          </thead>
          <tbody>{entries.map(e => <LogRow key={e.id} entry={e} />)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {header}
      {toolbar}
      {body}
      {moreError && <p role="alert">{moreError.message}</p>}
      {hasMore && <p><Button variant="secondary" onClick={loadMore} disabled={busy}>More entries</Button></p>}
    </>
  );
}
