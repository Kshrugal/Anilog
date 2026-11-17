import { useEffect, useState } from 'react';
import { collection, doc, getDocsFromServer, onSnapshot, writeBatch } from 'firebase/firestore';
import { publicLibraryEntry } from '../services/profile-identity';

export function usePublicLibrary(db: any, appId: string, uid: string) {
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    if (!db || !uid) return;
    let active = true;
    let queue = Promise.resolve();
    let published: Map<string, any> | null = null;
    const base = `artifacts/${appId}/public/data/users/${uid}`;
    const unsubscribe = onSnapshot(collection(db, `${base}/animeList`), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      queue = queue.catch(() => {}).then(async () => {
        if (!active) return;
        if (!published) {
          const existing = await getDocsFromServer(collection(db, `${base}/publicLibrary`));
          published = new Map(existing.docs.map(d => [d.id, d.data()]));
        }
        if (!active) return;
        const desired = new Map(snapshot.docs.map(d => [d.id, publicLibraryEntry({ kitsuId: d.id, ...d.data() })]));
        const changes: { id: string; data?: any }[] = [];
        const old = published;
        for (const [id, data] of desired) if (JSON.stringify(Object.entries(data).sort()) !== JSON.stringify(Object.entries(old.get(id) || {}).sort())) changes.push({ id, data });
        for (const id of old.keys()) if (!desired.has(id)) changes.push({ id });
        for (let i = 0; i < changes.length; i += 400) {
          if (!active) return;
          const batch = writeBatch(db);
          for (const change of changes.slice(i, i + 400)) {
            const target = doc(db, `${base}/publicLibrary/${change.id}`);
            if (change.data) batch.set(target, change.data); else batch.delete(target);
          }
          await batch.commit();
          for (const change of changes.slice(i, i + 400)) {
            if (change.data) old.set(change.id, change.data); else old.delete(change.id);
          }
        }
        if (active) setError('');
      }).catch(() => { published = null; if (active) setError('Public library sync failed. Your private library is safe; reload to retry.'); });
    }, () => { if (active) setError('Public library sync is unavailable.'); });
    return () => { active = false; unsubscribe(); };
  }, [db, appId, uid]);
  return error;
}
