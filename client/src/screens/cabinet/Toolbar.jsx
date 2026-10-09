import { useEffect, useState } from 'react';
import { Field, TextInput, Select, Checkbox } from '../../components/Field.jsx';
import { SOURCE_KINDS } from '../../lib/cabinet.js';

const SHOW = [
  { value: 'all', label: 'Everything' },
  { value: 'low', label: 'Running low' },
  { value: 'expiring', label: 'Use soon' },
  { value: 'expired', label: 'Past its best' },
];

export function Toolbar({ params, setParam, sections, suppliers, spots }) {
  const urlQ = params.get('q') || '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  useEffect(() => {
    if (q === urlQ) return undefined;
    const t = setTimeout(() => setParam('q', q), 250);
    return () => clearTimeout(t);
  }, [q, urlQ, setParam]);
  const select = (key, fallback = '') => ({ value: params.get(key) || fallback, onChange: e => setParam(key, e.target.value) });
  const ids = list => list.map(s => ({ value: String(s.id), label: s.name }));
  return (
    <div className="toolbar" role="search">
      <Field label="Search"><TextInput type="search" placeholder="Calendula, beeswax, dropper…" value={q} onChange={e => setQ(e.target.value)} /></Field>
      <Field label="Section"><Select placeholder="All sections" options={ids(sections)} {...select('section_id')} /></Field>
      <Field label="Show"><Select options={SHOW} {...select('status', 'all')} /></Field>
      <Field label="Source"><Select placeholder="Any source" options={SOURCE_KINDS} {...select('source_kind')} /></Field>
      <Field label="Supplier"><Select placeholder="Any supplier" options={ids(suppliers)} {...select('supplier_id')} /></Field>
      <Field label="Storage"><Select placeholder="Anywhere" options={spots.map(s => ({ value: s, label: s }))} {...select('storage_spot')} /></Field>
      <Checkbox label="Show used up" checked={params.get('include_used_up') === '1'} onChange={e => setParam('include_used_up', e.target.checked ? '1' : '')} />
    </div>
  );
}
