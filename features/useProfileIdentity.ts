import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { defaultIdentity, normalizeIdentity } from '../services/profile-identity';

export function useProfileIdentity(db: any, appId: string, uid: string) {
  const [state, setState] = useState({ uid: '', identity: defaultIdentity(), revision: 0, loading: true, error: '' });
  useEffect(() => {
    if (!db || !uid) return;
    const target = doc(db, `artifacts/${appId}/public/data/profileIdentity/${uid}`);
    let identity: any, showcases: Record<string, any> | undefined;
    const publish = () => {
      if (identity === undefined || showcases === undefined) return;
      const revision = identity?.revision || 0;
      if (Object.values(showcases).some(value => value.revision !== revision)) return;
      setState({ uid, identity: normalizeIdentity({ ...identity, showcases: Object.fromEntries(Object.entries(showcases).map(([kind, value]) => [kind, value.items])) }), revision, loading: false, error: '' });
    };
    const failed = () => setState({ uid, identity: defaultIdentity(), revision: 0, loading: false, error: 'Profile customization could not be loaded.' });
    const stopIdentity = onSnapshot(target, snapshot => { identity = snapshot.data() || null; publish(); }, failed);
    const stopShowcases = onSnapshot(collection(target, 'showcases'), snapshot => { showcases = Object.fromEntries(snapshot.docs.map(d => [d.id, d.data()])); publish(); }, failed);
    return () => { stopIdentity(); stopShowcases(); };
  }, [db, appId, uid]);
  return state.uid === uid ? state : { identity: defaultIdentity(), revision: 0, loading: true, error: '' };
}
