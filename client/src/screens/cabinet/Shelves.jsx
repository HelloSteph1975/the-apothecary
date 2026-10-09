import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { CabinetTabs } from '../../components/CabinetTabs.jsx';
import { Button } from '../../components/Button.jsx';
import { useApi } from '../../lib/useApi.js';
import { todayString } from '../../lib/today.js';
import { Toolbar } from './Toolbar.jsx';
import { ItemRow } from './ItemRow.jsx';
import { SectionManager } from './SectionManager.jsx';

const FILTERS = ['q', 'section_id', 'status', 'source_kind', 'supplier_id', 'storage_spot', 'include_used_up'];

export function Shelves() {
  const [params, setParams] = useSearchParams();
  const [managing, setManaging] = useState(false);
  const sections = useApi('/api/sections');
  const suppliers = useApi('/api/suppliers');
  const spots = useApi('/api/storage-spots');

  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value && !(key === 'status' && value === 'all')) next.set(key, value); else next.delete(key);
      return next;
    });
  }, [setParams]);

  const query = new URLSearchParams({ today: todayString() });
  FILTERS.forEach(k => { if (params.get(k)) query.set(k, params.get(k)); });
  const items = useApi(`/api/items?${query}`, { keepPrevious: true });
  const filtered = FILTERS.some(k => params.get(k));

  const bySection = useMemo(() => {
    const map = new Map();
    (items.data || []).forEach(it => map.set(it.section_id, [...(map.get(it.section_id) || []), it]));
    return map;
  }, [items.data]);

  const reloadAll = () => { sections.reload(); items.reload(); };
  const error = sections.error || items.error;
  const header = (
    <>
      <PageHeader title="Herb cabinet" subtitle="Herbs and supplies, jar by jar" actions={<WaxSealLink to="/cabinet/new">Add to the cabinet</WaxSealLink>} />
      <CabinetTabs />
    </>
  );

  if (error) {
    return (
      <>{header}
        <p role="alert">{error.message}</p>
        <Button onClick={reloadAll}>Try again</Button>
      </>
    );
  }
  if (!sections.data || !items.data) return <>{header}<p>Opening the cabinet…</p></>;

  const empty = items.data.length === 0 && !filtered;
  return (
    <>
      {header}
      <Toolbar params={params} setParam={setParam} sections={sections.data} suppliers={suppliers.data || []} spots={spots.data || []} />
      <p><Button variant="secondary" size="sm" onClick={() => setManaging(true)}>Manage sections</Button></p>
      {empty ? (
        <ParchmentCard title="Your cabinet is empty" botanical="calendula">
          <p><Link to="/cabinet/new">Add your first jar</Link></p>
        </ParchmentCard>
      ) : sections.data.map(s => {
        const list = bySection.get(s.id) || [];
        if (!list.length && filtered) return null;
        return (
          <ParchmentCard key={s.id} title={`${s.name} (${list.length})`} className="shelf">
            {list.length ? list.map(it => <ItemRow key={it.id} item={it} />) : (
              <p>Nothing on this shelf yet. <Link to={`/cabinet/new?section=${s.id}`}>Add</Link></p>
            )}
          </ParchmentCard>
        );
      })}
      <SectionManager open={managing} onClose={() => setManaging(false)} sections={sections.data} onChange={reloadAll} />
    </>
  );
}
