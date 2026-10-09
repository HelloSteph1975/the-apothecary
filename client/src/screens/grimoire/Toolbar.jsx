import { useEffect, useState } from 'react';
import { Field, TextInput, Select, Checkbox } from '../../components/Field.jsx';
import { HERB_PARTS, PLANETS, ELEMENTS } from '../../lib/grimoire.js';

export function Toolbar({ params, setParam }) {
  const urlQ = params.get('q') || '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  useEffect(() => {
    if (q === urlQ) return undefined;
    const t = setTimeout(() => setParam('q', q), 250);
    return () => clearTimeout(t);
  }, [q, urlQ, setParam]);
  const select = key => ({ value: params.get(key) || '', onChange: e => setParam(key, e.target.value) });
  return (
    <div className="toolbar" role="search">
      <Field label="Search"><TextInput type="search" placeholder="Name, Latin name or association" value={q} onChange={e => setQ(e.target.value)} /></Field>
      <Field label="Part used"><Select placeholder="Any part" options={HERB_PARTS} {...select('part')} /></Field>
      <Field label="Planet"><Select placeholder="Any planet" options={PLANETS} {...select('planet')} /></Field>
      <Field label="Element"><Select placeholder="Any element" options={ELEMENTS} {...select('element')} /></Field>
      <Checkbox label="Only herbs in my cabinet" checked={params.get('has_jars') === '1'} onChange={e => setParam('has_jars', e.target.checked ? '1' : '')} />
      <Checkbox label="Has a pregnancy caution" checked={params.get('caution') === 'pregnancy'} onChange={e => setParam('caution', e.target.checked ? 'pregnancy' : '')} />
    </div>
  );
}
