import { Link } from 'react-router-dom';
import { ParchmentCard } from '../components/ParchmentCard.jsx';

export function NotFound() {
  return (
    <ParchmentCard title="Lost in the stacks">
      <p>That page isn't in the cabinet. <Link to="/">Back to Today</Link></p>
    </ParchmentCard>
  );
}
