import { collection, limit, onSnapshot, orderBy, query, where, type Firestore } from 'firebase/firestore';

export function followedIds(friends: unknown[]) {
  return [...new Set(friends.map(friend => typeof friend === 'string' ? friend : (friend as { uid?: unknown } | null)?.uid)
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/')))];
}

export function subscribeCommunityActivity(db: Firestore, appId: string, authorIds: string[] | null, count: number, onItems: (items: any[]) => void, onError: (error: Error) => void) {
  const ref = collection(db, `artifacts/${appId}/public/data/activity`);
  const batches: (string[] | null)[] = authorIds === null ? [null] : [];
  if (authorIds) for (let i = 0; i < authorIds.length; i += 30) batches.push(authorIds.slice(i, i + 30));
  if (!batches.length) onItems([]);
  const results = new Map<number, any[]>();
  const stops = batches.map((batch, index) => onSnapshot(query(ref, ...(batch ? [where('userId', 'in', batch)] : []), orderBy('timestamp', 'desc'), limit(count)), snapshot => {
    results.set(index, snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id })));
    if (results.size === batches.length) {
      onItems([...results.values()].flat().sort((a, b) =>
        (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0) ||
        (b.timestamp?.nanoseconds || 0) - (a.timestamp?.nanoseconds || 0) ||
        b.id.localeCompare(a.id)).slice(0, count));
    }
  }, onError));
  return () => stops.forEach(stop => stop());
}
