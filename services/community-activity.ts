import { collection, doc, limit, onSnapshot, orderBy, query, where, type Firestore } from 'firebase/firestore';

export function followedIds(friends: unknown[]) {
  return [...new Set(friends.map(friend => typeof friend === 'string' ? friend : (friend as { uid?: unknown } | null)?.uid)
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && !id.includes('/')))];
}

export function followingPeople(profile: { followingIds?: unknown[]; friends?: unknown[] } | undefined) {
  const friends = profile?.friends || [];
  const names = new Map(friends.flatMap(friend => {
    const person = friend as { uid?: unknown; username?: unknown } | null;
    return typeof person?.uid === 'string' && typeof person.username === 'string' ? [[person.uid, person.username] as const] : [];
  }));
  return followedIds(profile?.followingIds || friends).map(uid => ({ uid, username: names.get(uid) || 'AniLog member' }));
}

export const FOLLOWER_ACTIVITY_AUDIENCE = 'followers';

export function recentActivityId(id: string) {
  // Shared activity queries use the default document ID order.
  return `${String(9_999_999_999_999 - Date.now()).padStart(13, '0')}-${id}`;
}

const EPISODE_SESSION_GAP_MS = 24 * 60 * 60 * 1000;

function compareActivity(a, b) {
  return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0) ||
    (b.timestamp?.nanoseconds || 0) - (a.timestamp?.nanoseconds || 0) ||
    b.id.localeCompare(a.id);
}

export function groupEpisodeActivity(items: any[]) {
  const sessions = new Map<string, { episode: number; time: number; index: number }>();
  const grouped: any[] = [];
  // Work oldest first so the first episode's thread stays attached as a session grows.
  for (const item of [...items].sort(compareActivity).reverse()) {
    const match = item.type === 'progress' && !item.noteContent && !item.spoiler &&
      /^watched (?:episode|ep) ([1-9]\d*)(?: of)?$/.exec(item.context);
    const episode = match ? Number(match[1]) : NaN;
    const time = item.timestamp?.seconds * 1000 + (item.timestamp?.nanoseconds || 0) / 1e6;
    if (!item.userId || !item.animeKitsuId || !Number.isSafeInteger(episode) || !Number.isFinite(time)) {
      grouped.push(item);
      continue;
    }
    const key = JSON.stringify([item.userId, String(item.animeKitsuId), item.sharedBy ?? null, item.audience ?? null]);
    const previous = sessions.get(key);
    if (previous && episode === previous.episode + 1 && time - previous.time <= EPISODE_SESSION_GAP_MS) {
      const first = grouped[previous.index];
      const episodes = [...(first.episodes || [{ id: first.id, number: previous.episode }]), { id: item.id, number: episode }];
      grouped[previous.index] = {
        ...item,
        id: first.id,
        context: `watched episodes ${episodes[0].number}–${episode} of`,
        episodes,
      };
      sessions.set(key, { ...previous, episode, time });
    } else {
      sessions.set(key, { episode, time, index: grouped.length });
      grouped.push(item);
    }
  }
  return grouped.sort(compareActivity);
}

export function subscribeCommunityActivity(db: Firestore, appId: string, viewerId: string, authorIds: string[], count: number, onItems: (items: any[]) => void, onError: (error: Error) => void) {
  const ref = collection(db, `artifacts/${appId}/public/data/activity`);
  if (!viewerId || !authorIds.length) { onItems([]); return () => {}; }
  const results = new Map<string, any[]>();
  const publish = () => {
    const unique = new Map([...results.values()].flat().map(item => [item.id, item]));
    onItems(groupEpisodeActivity([...unique.values()]).slice(0, count));
  };
  const stops = authorIds.map(authorId => {
    const own = authorId === viewerId;
    const listen = (scope: 'own' | 'followers' | 'mutual') => onSnapshot(
      own ? query(ref, where('userId', '==', viewerId), orderBy('timestamp', 'desc'), limit(Math.max(count, 100)))
        : query(ref, where('userId', '==', authorId), where('sharedBy', '==', authorId),
          ...(scope === 'followers' ? [where('audience', '==', FOLLOWER_ACTIVITY_AUDIENCE)] : []),
          limit(Math.max(count, scope === 'followers' ? 25 : count))),
      { includeMetadataChanges: true },
      snapshot => {
        const key = `${authorId}:${scope}`;
        // Require server authorization before showing another account's activity.
        if (!own && snapshot.metadata.fromCache) { results.delete(key); publish(); return; }
        results.set(key, snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id })));
        publish();
      }, error => {
        results.delete(`${authorId}:${scope}`); publish();
        if (own || error.code !== 'permission-denied') onError(error);
      },
    );
    if (own) return listen('own');
    const stopFollowers = listen('followers');
    let stopPosts: (() => void) | undefined;
    const stopProfile = onSnapshot(doc(db, `artifacts/${appId}/public/data/users/${authorId}`), profile => {
      const data = profile.data();
      const followsBack = followedIds(data?.followingIds || data?.friends || []).includes(viewerId);
      if (followsBack && !stopPosts) stopPosts = listen('mutual');
      if (!followsBack) {
        stopPosts?.(); stopPosts = undefined;
        results.delete(`${authorId}:mutual`); publish();
      }
    }, error => {
      stopPosts?.(); stopPosts = undefined;
      results.delete(`${authorId}:mutual`); publish(); onError(error);
    });
    return () => { stopFollowers(); stopProfile(); stopPosts?.(); };
  });
  return () => stops.forEach(stop => stop());
}
