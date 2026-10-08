import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';

export function DrawerSoon({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <ParchmentCard title="This drawer is being built">
        <p className="muted">It opens in a later stage. Everything you add elsewhere is kept safe in the meantime.</p>
      </ParchmentCard>
    </>
  );
}
