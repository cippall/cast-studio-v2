import { useEffect, useCallback, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

/**
 * Guard against navigating away with unsaved form changes.
 *
 * Two layers of protection:
 * 1. `useBlocker` — intercepts in-app route navigations (link clicks, back/forward,
 *    programmatic navigate). Shows a custom modal-like confirmation via the router.
 * 2. `useBeforeUnload` — intercepts browser-level navigation (tab close, reload,
 *    external link). Shows the native browser "Leave site?" dialog.
 *
 * The guard automatically disables itself when `dirty` goes back to false
 * (e.g. after a successful save).
 */
export function useUnsavedChanges(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // --- In-app navigation guard (React Router v6 data router) ---
  const blocker = useBlocker(useCallback(() => dirtyRef.current, []));

  // Reset blocker when dirty clears (e.g. after save)
  useEffect(() => {
    if (!dirty && blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [dirty, blocker]);

  // --- Browser-level guard (tab close, reload) ---
  useBeforeUnload(
    useCallback((event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
      }
    }, []),
  );
}
