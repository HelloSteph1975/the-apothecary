import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';

export function NotFound() {
  return (
    <>
      <PageHeader title="Lost in the stacks" />
      <ParchmentCard>
        <p>That page isn't in the cabinet. <Link to="/">Back to Today</Link></p>
      </ParchmentCard>
    </>
  );
}
