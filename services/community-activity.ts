import { collection, doc, limit, onSnapshot, orderBy, query, where, type Firestore } from 'firebase/firestore';

export function followedIds(friends: unknown[]) {
  return [...new Set(friends.map(friend => typeof friend === 'string' ? friend : (friend as { uid?: unknown } | null)?.uid)
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/')))];
}

export function subscribeCommunityActivity(db: Firestore, appId: string, viewerId: string, authorIds: string[], count: number, onItems: (items: any[]) => void, onError: (error: Error) => void) {
  const ref = collection(db, `artifacts/${appId}/public/data/activity`);
  if (!viewerId || !authorIds.length) { onItems([]); return () => {}; }
  const results = new Map<string, any[]>();
  const publish = () => onItems([...results.values()].flat().sort((a, b) =>
    (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0) ||
    (b.timestamp?.nanoseconds || 0) - (a.timestamp?.nanoseconds || 0) ||
    b.id.localeCompare(a.id)).slice(0, count));
  const stops = authorIds.map(authorId => {
    const own = authorId === viewerId;
    const listen = () => onSnapshot(
      own ? query(ref, where('userId', '==', viewerId), orderBy('timestamp', 'desc'), limit(count))
        : query(ref, where('userId', '==', authorId), where('sharedBy', '==', authorId), limit(count)),
      { includeMetadataChanges: true },
      snapshot => {
        // Never serve cached friend posts before the server confirms access.
        if (!own && snapshot.metadata.fromCache) { results.delete(authorId); publish(); return; }
        results.set(authorId, snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id })));
        publish();
      }, error => {
        results.delete(authorId); publish();
        if (own || error.code !== 'permission-denied') onError(error);
      },
    );
    if (own) return listen();
    let stopPosts: (() => void) | undefined;
    const stopProfile = onSnapshot(doc(db, `artifacts/${appId}/public/data/users/${authorId}`), profile => {
      const data = profile.data();
      const followsBack = followedIds(data?.followingIds || data?.friends || []).includes(viewerId);
      if (followsBack && !stopPosts) stopPosts = listen();
      if (!followsBack) {
        stopPosts?.(); stopPosts = undefined;
        results.delete(authorId); publish();
      }
    }, error => {
      stopPosts?.(); stopPosts = undefined;
      results.delete(authorId); publish(); onError(error);
    });
    return () => { stopProfile(); stopPosts?.(); };
  });
  return () => stops.forEach(stop => stop());
}
