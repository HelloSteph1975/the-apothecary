import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ParchmentCard } from '../../components/ParchmentCard.jsx';
import { WaxSealLink } from '../../components/WaxSeal.jsx';
import { Button } from '../../components/Button.jsx';
import { Field, TextInput, Select, Checkbox } from '../../components/Field.jsx';
import { useApi } from '../../lib/useApi.js';
import { formatAmount } from '../../lib/cabinet.js';
import { TypeIcon } from '../../lib/recipes.jsx';

const FILTERS = ['q', 'type_id', 'herb_id', 'topical'];

function Toolbar({ params, setParam, types, herbs }) {
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
      <Field label="Search"><TextInput type="search" placeholder="Salve, tea, calendula…" value={q} onChange={e => setQ(e.target.value)} /></Field>
      <Field label="Type"><Select placeholder="All types" options={types.map(t => ({ value: String(t.id), label: t.name }))} {...select('type_id')} /></Field>
      <Field label="Herb"><Select placeholder="Any herb" options={herbs.map(h => ({ value: String(h.id), label: h.common_name }))} {...select('herb_id')} /></Field>
      <Checkbox label="Only skin recipes" checked={params.get('topical') === '1'} onChange={e => setParam('topical', e.target.checked ? '1' : '')} />
    </div>
  );
}

function RecipeCard({ recipe }) {
  const names = recipe.herb_names || [];
  const more = names.length - 3;
  const yieldText = recipe.yield_amount == null ? '' : formatAmount(recipe.yield_amount, recipe.yield_unit);
  return (
    <ParchmentCard className="herb-card recipe-card">
      <div className="herb-card-head">
        {recipe.cover
          ? <img className="herb-cover" src={`/photos/${recipe.cover}`} alt="" />
          : <span className="herb-glyph recipe-glyph"><TypeIcon icon={recipe.type_icon} size={32} /></span>}
        <div>
          <h2><Link to={`/recipes/${recipe.id}`}>{recipe.name}</Link></h2>
          <p className="muted">{recipe.type_name}</p>
        </div>
      </div>
      {yieldText && <p>{yieldText}</p>}
      {names.length > 0 && <p className="muted">{names.slice(0, 3).join(', ')}{more > 0 && ` and ${more} more`}</p>}
    </ParchmentCard>
  );
}

export function RecipeBook() {
  const [params, setParams] = useSearchParams();
  const setParam = useCallback((key, value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  }, [setParams]);
  const types = useApi('/api/recipe-types');
  const herbs = useApi('/api/herbs');
  const query = new URLSearchParams();
  FILTERS.forEach(k => { if (params.get(k)) query.set(k, params.get(k)); });
  const recipes = useApi(`/api/recipes?${query}`, { keepPrevious: true });
  const filtered = FILTERS.some(k => params.get(k));

  const header = (
    <PageHeader title="Recipe book" subtitle="Your recipes, ready to make"
      actions={<><Link to="/recipes/types">Recipe types</Link><WaxSealLink to="/recipes/new">Add a recipe</WaxSealLink></>} />
  );
  const toolbar = <Toolbar params={params} setParam={setParam} types={types.data || []} herbs={herbs.data || []} />;

  if (recipes.error) {
    return (
      <>{header}{toolbar}
        <p role="alert">{recipes.error.message}</p>
        <Button onClick={recipes.reload}>Try again</Button>
      </>
    );
  }
  if (!recipes.data) return <>{header}<p>Opening the recipe book…</p></>;

  return (
    <>
      {header}
      {toolbar}
      {recipes.data.length === 0 ? (
        filtered ? (
          <ParchmentCard title="No recipes match."><p className="muted">Try fewer filters.</p></ParchmentCard>
        ) : (
          <ParchmentCard title="Your recipe book is empty" botanical="calendula">
            <p><Link to="/recipes/new">Add a recipe</Link></p>
          </ParchmentCard>
        )
      ) : (
        <div className="card-grid">{recipes.data.map(r => <RecipeCard key={r.id} recipe={r} />)}</div>
      )}
    </>
  );
}
