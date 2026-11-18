import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function usePrivateAppearance(db: any, appId: string, uid: string, value: any, apply: (value: any) => void) {
  const [loaded, setLoaded] = useState('');
  const [error, setError] = useState('');
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; }, [apply]);
  const serialized = JSON.stringify(value);
  const last = useRef('');
  useEffect(() => {
    setLoaded(''); setError(''); let active = true;
    if (!db || !uid) return;
    getDoc(doc(db, `artifacts/${appId}/privateUsers/${uid}/settings/appearance`)).then(snapshot => {
      if (!active) return;
      if (snapshot.exists()) { last.current = JSON.stringify(snapshot.data()); applyRef.current(snapshot.data()); }
      else last.current = '';
      setLoaded(uid);
    }).catch(() => { if (active) setError('Private appearance preferences could not be loaded. Local preferences are unchanged.'); });
    return () => { active = false; };
  }, [db, appId, uid]);
  useEffect(() => {
    if (!uid || loaded !== uid || serialized === last.current) return;
    let active = true;
    const timer = setTimeout(() => {
      setDoc(doc(db, `artifacts/${appId}/privateUsers/${uid}/settings/appearance`), JSON.parse(serialized)).then(() => { if (active) { last.current = serialized; setError(''); } }).catch(() => { if (active) setError('Appearance is saved locally, but account sync failed. Change a preference or reload to retry.'); });
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [db, appId, uid, loaded, serialized]);
  return error;
}
