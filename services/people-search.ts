import { collection, getDocsFromServer, limit, query, where, type Firestore } from 'firebase/firestore';

export const usernameSearchKey = (name: string) => name.trim().toLowerCase();

export async function searchPeople(db: Firestore, appId: string, viewer: string, input: string) {
  const term = usernameSearchKey(input);
  if (!term) return [];
  const users = collection(db, `artifacts/${appId}/public/data/users`);
  const found = await getDocsFromServer(query(users, where('usernameSearch', '>=', term),
    where('usernameSearch', '<=', term + '\u{10ffff}'), limit(12)));
  return found.docs.flatMap(entry => entry.id !== viewer && typeof entry.data().username === 'string'
    ? [{ uid: entry.id, username: entry.data().username as string }] : []);
}
