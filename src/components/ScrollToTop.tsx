import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * ScrollToTop component:
 * Listens to route pathname changes and resets window scroll to (0, 0).
 * Does not trigger on in-page state updates (e.g., day tabs, budget sliders, filters).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
