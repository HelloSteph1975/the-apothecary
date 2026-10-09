import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmProvider.jsx';

// Asks before leaving a form with unsaved changes. Call markSaved() right
// before navigating away after a successful save so the guard stays quiet.
export function useLeaveGuard(dirty) {
  const confirm = useConfirm();
  const saved = useRef(false);
  const blocker = useBlocker(() => dirty && !saved.current);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({ title: 'Leave without saving?', body: 'Your changes will be lost.', confirmLabel: 'Leave', danger: true })
      .then(ok => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);
  return () => { saved.current = true; };
}
