import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput } from '../../components/Field.jsx';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { TypeIcon, skyStampText, entryWhen } from '../../lib/journal.jsx';

const VIEWS = [
  { value: 'list', label: 'All' },
  { value: 'type', label: 'By type' },
  { value: 'tag', label: 'By tag' },
  { value: 'moon', label: 'By moon' },
];
const MOON_GROUPS = [
  { value: 'new', label: 'New moon' },
  { value: 'waxing', label: 'Waxing' },
  { value: 'full', label: 'Full moon' },
  { value: 'waning', label: 'Waning' },
];
const CHOICE = { type: 'type_id', tag: 'tag' };

const queryOf = pairs => {
  const qs = new URLSearchParams();
  Object.entries(pairs).forEach(([k, v]) => { if (v) qs.set(k, v); });
  return qs.toString();
};

function EntryCard({ entry }) {
  const sky = skyStampText(entry.sky, entry.entry_date);
  return (
    <ParchmentCard className="herb-card journal-card">
      <div className="herb-card-head">
        {entry.cover
          ? <img className="herb-cover" src={`/photos/${entry.cover}`} alt="" />
          : <span className="herb-glyph recipe-glyph"><TypeIcon icon={entry.type?.icon} size={32} /></span>}
        <div>
          <p className="muted journal-type"><TypeIcon icon={entry.type?.icon} size={16} /> {entry.type?.name}</p>
          <h2><Link to={`/journal/${entry.id}`}>{entry.title}</Link></h2>
          <p className="muted">{entryWhen(entry.entry_date, entry.entry_time)}</p>
        </div>
      </div>
      {sky && <p className="muted">{sky}</p>}
      {entry.excerpt && <p>{entry.excerpt}</p>}
      {entry.tags?.length > 0 && <p className="chip-row">{entry.tags.map(t => <span key={t} className="badge badge-brass">{t}</span>)}</p>}
    </ParchmentCard>
  );
}

// Entries for one query, a page at a time: the first page comes from useApi, "More entries" appends the rest.
function useEntries(base) {
  const first = useApi(base, { keepPrevious: true });
  const fresh = { base, pages: [], page: 1, error: null, busy: false };
  const [more, setMore] = useState(fresh);
  const current = more.base === base ? more : fresh;
  // Every reset bumps the generation, so a page requested before it can't land in the new list.
  const generation = useRef(0);
  useEffect(() => { generation.current += 1; setMore({ base, pages: [], page: 1, error: null, busy: false }); }, [base, first.data]);
  const entries = first.data ? [...first.data.entries, ...current.pages] : [];
  const total = first.data?.total ?? 0;
  const loadMore = async () => {
    if (first.loading) return;
    const page = current.page + 1;
    const mine = generation.current;
    setMore({ ...current, busy: true, error: null });
    try {
      const res = await api.get(`${base}&page=${page}`);
      setMore(m => (m.base === base && mine === generation.current ? { ...m, pages: [...m.pages, ...res.entries], page, busy: false } : m));
    } catch (err) {
      setMore(m => (m.base === base && mine === generation.current ? { ...m, busy: false, error: err } : m));
    }
  };
  // keepPrevious leaves the old query's page on screen while a new one loads; paging waits for the new first page.
  const settled = Boolean(first.data) && !first.loading;
  return { first, entries, hasMore: settled && entries.length < total, loadMore, busy: current.busy, moreError: current.error };
}

function EntryList({ state, empty }) {
  const { first, entries, hasMore, loadMore, busy, moreError } = state;
  if (first.error) return <><p role="alert">{first.error.message}</p><Button onClick={first.reload}>Try again</Button></>;
  if (!first.data) return <p>Opening the journal…</p>;
  return (
    <>
      {entries.length === 0 ? empty : <div className="card-grid">{entries.map(e => <EntryCard key={e.id} entry={e} />)}</div>}
      {moreError && <p role="alert">{moreError.message}</p>}
      {hasMore && <p><Button variant="secondary" onClick={loadMore} disabled={busy}>More entries</Button></p>}
    </>
  );
}

function MoonGroup({ group, count, q }) {
  const state = useEntries(count > 0 ? `/api/journal?${queryOf({ view: 'moon', phase_group: group.value, q })}` : null);
  return (
    <section aria-labelledby={`moon-${group.value}`} className="journal-group">
      <h2 id={`moon-${group.value}`}>{group.label} <span className="muted">({count})</span></h2>
      {count === 0 ? <p className="muted">Nothing under this moon yet.</p> : <EntryList state={state} empty={null} />}
    </section>
  );
}

export function Journal() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some(v => v.value === params.get('view')) ? params.get('view') : 'list';
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

  const choiceKey = CHOICE[view];
  const choice = choiceKey ? params.get(choiceKey) || '' : '';
  const grouped = view === 'moon';
  const groups = useApi(grouped ? `/api/journal?${queryOf({ view, q: urlQ })}` : null, { keepPrevious: true });
  const state = useEntries(grouped ? null : `/api/journal?${queryOf({ view, q: urlQ, ...(choiceKey ? { [choiceKey]: choice } : {}) })}`);
  const head = state.first.data;

  const header = (
    <PageHeader title="Journal" subtitle="Rituals, moons, dreams and notes"
      actions={<><Link to="/journal/photos">Photos</Link><Link to="/journal/types">Entry types</Link><WaxSealLink to="/journal/new">Write an entry</WaxSealLink></>} />
  );
  const tabs = (
    <nav className="tabs" aria-label="Journal views">
      {VIEWS.map(v => {
        const next = new URLSearchParams();
        if (v.value !== 'list') next.set('view', v.value);
        if (urlQ) next.set('q', urlQ);
        const qs = next.toString();
        return <Link key={v.value} className="tab" to={qs ? `?${qs}` : '?'} replace aria-current={view === v.value ? 'page' : undefined}>{v.label}</Link>;
      })}
    </nav>
  );
  const toolbar = (
    <div className="toolbar" role="search">
      <Field label="Search"><TextInput type="search" placeholder="Moon, rose, dream…" value={q} onChange={e => setQ(e.target.value)} /></Field>
    </div>
  );
  const chip = (value, label, count) => (
    <button key={value} type="button" className="chip" aria-pressed={choice === value} onClick={() => setParam(choiceKey, choice === value ? '' : value)}>
      {label} <span className="muted">({count})</span>
    </button>
  );
  const empty = urlQ
    ? <ParchmentCard title="No entries match."><p className="muted">Try a different search.</p></ParchmentCard>
    : <ParchmentCard title="Your journal is empty." botanical="calendula"><p><Link to="/journal/new">Write the first entry.</Link></p></ParchmentCard>;

  let body;
  if (grouped) {
    if (groups.error) body = <><p role="alert">{groups.error.message}</p><Button onClick={groups.reload}>Try again</Button></>;
    else if (!groups.data) body = <p>Opening the journal…</p>;
    else if (groups.data.groups.every(g => g.count === 0)) body = empty;
    else {
      body = groups.data.groups.map(g => (
        <MoonGroup key={`${g.group}|${urlQ}`} group={MOON_GROUPS.find(m => m.value === g.group)} count={g.count} q={urlQ} />
      ));
    }
  } else if (state.first.error) {
    body = <EntryList state={state} empty={empty} />;
  } else if (!head || head.view !== view) {
    body = <p>Opening the journal…</p>;
  } else if (view === 'list') {
    body = <EntryList state={state} empty={empty} />;
  } else {
    const items = view === 'type' ? head.types : head.tags;
    body = items.every(i => i.count === 0) ? empty : (
      <>
        <p className="chip-row" role="group" aria-label={view === 'type' ? 'Entry types' : 'Tags'}>
          {view === 'type' ? items.map(t => chip(String(t.id), t.name, t.count)) : items.map(t => chip(t.tag, t.tag, t.count))}
        </p>
        {choice
          ? <EntryList state={state} empty={empty} />
          : <p className="muted">{view === 'type' ? 'Pick a type to see its entries.' : 'Pick a tag to see its entries.'}</p>}
      </>
    );
  }

  return <>{header}{tabs}{toolbar}{body}</>;
}
