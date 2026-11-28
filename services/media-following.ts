import { collection, doc, getDocFromServer, getDocsFromServer, limit, query, where, type Firestore, type QuerySnapshot } from 'firebase/firestore';
import { followedIds } from './community-activity';
import { profileIsVn, profileMediaId, profileStatus } from './profile';

export function mediaFollowingId(media: unknown) {
  const id = profileMediaId(media);
  return /^(?:anilist:|v)?\d+$/.test(id) ? id : '';
}

export function activityTitle(item: {
  animeKitsuId?: string | number;
  animeTitle?: string;
  animeImageUrl?: string;
  mediaType?: string;
  provider?: string;
}) {
  const kitsuId = mediaFollowingId({ kitsuId: item.animeKitsuId, mediaType: item.mediaType, provider: item.provider });
  if (!kitsuId) return null;
  return { kitsuId, title: item.animeTitle, imageUrl: item.animeImageUrl };
}

const scoreOutOfTen = (score: unknown) => typeof score === 'number' && score > 0 && score <= 10 ? score : null;
const progressCount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

export type FollowingRow = {
  uid: string;
  username: string;
  status: string;
  progress: string;
  score: number | null;
  review: { text: string; spoiler: boolean } | null;
};

export function followingRow(uid: string, username: string, entry: Record<string, unknown>, reviews: QuerySnapshot | null, mediaId: string): FollowingRow {
  const vn = profileIsVn(entry);
  const status = profileStatus(typeof entry.status === 'string' ? entry.status : '');
  const labels = { watching: vn ? 'Reading' : 'Watching', completed: vn ? 'Finished' : 'Completed', planned: 'Planning', paused: 'Paused', dropped: 'Dropped' };
  const total = progressCount(entry.totalEpisodes);
  const current = progressCount(entry.watchedEpisodes);
  const progress = status === 'watching' && current > 0 ?
    (vn ? `${Math.min(current, 100)}% read` : total > 1 ? `Episode ${Math.min(current, total)} of ${total}` : total === 0 ? `Episode ${current}` : '') : '';
  const review = reviews?.docs.flatMap(snap => {
    const data = snap.data();
    return typeof data.noteContent === 'string' && data.noteContent.trim() && (data.mediaType || 'anime') === (vn ? 'vn' : 'anime') && data.animeKitsuId === mediaId
      ? [data] : [];
  }).sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))[0];
  const legacyScore = typeof review?.context === 'string' ? Number(/^reviewed (\d+)\/10$/.exec(review.context)?.[1]) : null;
  return { uid, username, status: labels[status] || '', progress,
    score: scoreOutOfTen(entry.score) ?? scoreOutOfTen(review?.reviewScore ?? legacyScore),
    review: review ? { text: review.noteContent.slice(0, 1000), spoiler: review.spoiler !== false } : null };
}

export async function loadMediaFollowing(db: Firestore, appId: string, viewerId: string, mediaId: string, signal: AbortSignal) {
  if (!viewerId || !/^(?:anilist:|v)?\d+$/.test(mediaId) || signal.aborted) return [];
  const base = `artifacts/${appId}/public/data`;
  const viewer = (await getDocFromServer(doc(db, `${base}/users/${viewerId}`))).data();
  const followed = viewer?.followingIds ?? viewer?.friends;
  const ids = followedIds(Array.isArray(followed) ? followed : []).filter(id => id !== viewerId);
  const rows: FollowingRow[] = [];
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(6, ids.length) }, async () => {
    while (!signal.aborted && index < ids.length) {
      const uid = ids[index++];
      try {
        // The exact public projection is permission-checked on the server, even for cached sessions.
        const entry = (await getDocFromServer(doc(db, `${base}/users/${uid}/publicLibrary/${mediaId}`))).data();
        if (!entry || signal.aborted || mediaFollowingId(entry) !== mediaId) continue;
        const author = (await getDocFromServer(doc(db, `${base}/users/${uid}`))).data();
        if (!author || typeof author.username !== 'string' || signal.aborted) continue;
        const followsBack = author.followingIds ?? author.friends;
        let reviews: QuerySnapshot | null = null;
        if (Array.isArray(followsBack) && followedIds(followsBack).includes(viewerId)) {
          // Reviews retain their separate mutual-follow permission; one-way follows can still show public scores.
          reviews = await getDocsFromServer(query(collection(db, `${base}/activity`),
            where('userId', '==', uid), where('sharedBy', '==', uid), where('type', '==', 'micro_review'),
            where('animeKitsuId', '==', mediaId), limit(12))).catch(() => null);
        }
        if (!signal.aborted) rows.push(followingRow(uid, author.username, entry, reviews, mediaId));
      } catch {
        // A denied/missing entry never contributes a row or count.
      }
    }
  }));
  return rows.sort((a, b) => Number(!!b.review) - Number(!!a.review) || (b.score ?? 0) - (a.score ?? 0) || a.username.localeCompare(b.username) || a.uid.localeCompare(b.uid));
}
