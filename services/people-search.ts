import { collection, getDocsFromServer, limit, query, where, type Firestore } from 'firebase/firestore';

export const usernameSearchKey = (name: string) => name.trim().toLowerCase();
type Person = { uid: string; username: string };
const legacyDirectory = new WeakMap<Firestore, Map<string, { expires: number; people: Promise<Person[]> }>>();

function legacyPeople(db: Firestore, appId: string, users: ReturnType<typeof collection>) {
  let byApp = legacyDirectory.get(db);
  if (!byApp) { byApp = new Map(); legacyDirectory.set(db, byApp); }
  const entry = byApp.get(appId);
  if (entry && entry.expires > Date.now()) return entry.people;
  // Read the small legacy directory once per cache window, never per keystroke.
  const people = getDocsFromServer(query(users, limit(100))).then(snapshot => snapshot.docs.flatMap(doc => {
    const data = doc.data();
    return typeof data.username === 'string' && !data.usernameSearch ? [{ uid: doc.id, username: data.username }] : [];
  }));
  byApp.set(appId, { expires: Date.now() + 60_000, people });
  void people.catch(() => { if (byApp.get(appId)?.people === people) byApp.delete(appId); });
  return people;
}

export async function isUsernameTaken(db: Firestore, appId: string, input: string, currentUid?: string) {
  const key = usernameSearchKey(input);
  const users = collection(db, `artifacts/${appId}/public/data/users`);
  const indexed = await getDocsFromServer(query(users, where('usernameSearch', '==', key), limit(2)));
  if (indexed.docs.some(profile => profile.id !== currentUid)) return true;
  return (await legacyPeople(db, appId, users)).some(person => person.uid !== currentUid && usernameSearchKey(person.username) === key);
}

export async function searchPeople(db: Firestore, appId: string, viewer: string, input: string) {
  const term = usernameSearchKey(input);
  if (!term) return [];
  const users = collection(db, `artifacts/${appId}/public/data/users`);
  const found = await getDocsFromServer(query(users, where('usernameSearch', '>=', term),
    where('usernameSearch', '<=', term + '\u{10ffff}'), limit(12)));
  const indexed = found.docs.flatMap(entry => entry.id !== viewer && typeof entry.data().username === 'string'
    ? [{ uid: entry.id, username: entry.data().username as string }] : []);
  if (indexed.length >= 10) return indexed.slice(0, 10);
  const legacy = await legacyPeople(db, appId, users).catch(() => []);
  const results = new Map(indexed.map(person => [person.uid, person]));
  for (const person of legacy) {
    if (person.uid !== viewer && !results.has(person.uid) && usernameSearchKey(person.username).startsWith(term)) results.set(person.uid, person);
  }
  return [...results.values()].sort((a, b) => usernameSearchKey(a.username).localeCompare(usernameSearchKey(b.username))).slice(0, 10);
}
