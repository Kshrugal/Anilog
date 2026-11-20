import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { followedIds } from './community-activity';

export interface FollowPerson { uid: string; username: string }
export interface FollowNotice {
  id: string;
  userId: string;
  username: string;
  direction: 'incoming' | 'outgoing';
  timestamp?: { seconds: number };
}

export async function setFollowing(db: Firestore, appId: string, uid: string, target: FollowPerson, following: boolean) {
  if (!uid || !target.uid || uid === target.uid || target.uid.includes('/')) return false;
  const base = `artifacts/${appId}/public/data`;
  const own = doc(db, `${base}/users/${uid}`);
  const peer = doc(db, `${base}/users/${target.uid}`);
  return runTransaction(db, async tx => {
    const [me, them] = await Promise.all([tx.get(own), tx.get(peer)]);
    if (!me.exists() || !them.exists()) throw new Error('Profile no longer exists.');
    const existingFriends = me.data().friends || [];
    const currentIds = followedIds(me.data().followingIds || existingFriends);
    if (currentIds.includes(target.uid) === following) return following;
    const nextFriends = existingFriends.filter(friend => (typeof friend === 'string' ? friend : friend?.uid) !== target.uid);
    if (following) nextFriends.push({ uid: target.uid, username: them.data().username });
    tx.update(own, { friends: nextFriends, followingIds: followedIds(nextFriends) });
    if (following) {
      const stamp = serverTimestamp();
      tx.set(doc(db, `${base}/followInboxes/${target.uid}/items/in_${uid}`), {
        userId: uid, username: me.data().username, direction: 'incoming', timestamp: stamp,
      });
      tx.set(doc(db, `${base}/followInboxes/${uid}/items/out_${target.uid}`), {
        userId: target.uid, username: them.data().username, direction: 'outgoing', timestamp: stamp,
      });
    }
    return following;
  });
}

export function subscribeFollowNotices(db: Firestore, appId: string, uid: string, receive: (items: FollowNotice[]) => void, fail: () => void) {
  const ref = collection(db, `artifacts/${appId}/public/data/followInboxes/${uid}/items`);
  return onSnapshot(query(ref, orderBy('timestamp', 'desc'), limit(25)), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache) return;
    receive(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as FollowNotice));
  }, fail);
}
