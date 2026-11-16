import { useEffect, useState } from 'react';
import { cachedCatalogue, loadFranchiseCatalogue } from '../services/franchise-catalogue';
import type { Catalogue } from '../services/franchises';

export function useFranchiseCatalogue(entries: Record<string, any>[]) {
  const [catalogue, setCatalogue] = useState<Catalogue>(cachedCatalogue);
  const [state, setState] = useState({ loading: false, error: '', done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);
  // IDs, rather than live progress/rating changes, determine public metadata needs.
  const key = entries.map(e => `${e.provider || ''}:${e.kitsuId || e.id}:${e.anilistId || ''}`).sort().join('|');
  useEffect(() => {
    let active = true;
    if (!entries.length) { setState({ loading: false, error: '', done: 0, total: 0 }); return; }
    setState({ loading: true, error: '', done: 0, total: entries.length });
    loadFranchiseCatalogue(entries, progress => { if (active) setState({ loading: true, error: '', ...progress }); }).then(value => {
      if (active) { setCatalogue(value); setState(s => ({ ...s, loading: false })); }
    }).catch(error => { if (active) { setCatalogue(cachedCatalogue()); setState(s => ({ ...s, loading: false, error: error.message || 'Some catalogue relationships are unavailable.' })); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { catalogue, state, retry: () => setAttempt(value => value + 1) };
}
