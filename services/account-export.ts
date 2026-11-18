import { getAuth } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, query, where, type Firestore } from 'firebase/firestore';
import { normalizeIdentity } from './profile-identity';

export async function loadAccountExport(db: Firestore, appId: string, uid: string) {
  const auth = getAuth(db.app);
  const session = auth.currentUser;
  const verifySession = () => {
    if (!session || session.isAnonymous || session.uid !== uid || auth.currentUser !== session) {
      throw new Error('Sign in again before downloading your data.');
    }
  };
  verifySession();
  const root = `artifacts/${appId}/public/data`;
  const identityRef = doc(db, `${root}/profileIdentity/${uid}`);
  const own = (name: string) => query(collection(db, `${root}/${name}`), where('userId', '==', uid));
  const [library, activity, decks, identity, showcases] = await Promise.all([
    getDocsFromServer(collection(db, `${root}/users/${uid}/animeList`)),
    getDocsFromServer(own('activity')),
    getDocsFromServer(own('grids')),
    getDocFromServer(identityRef),
    getDocsFromServer(collection(identityRef, 'showcases')),
  ]);
  verifySession();
  const profile = identity.data();
  if (showcases.docs.some(item => !profile || item.data().revision !== profile.revision)) {
    throw new Error('Your profile changed while preparing the export. Please try again.');
  }
  return {
    library: library.docs.map(item => ({ ...item.data(), id: item.id })),
    activity: activity.docs.filter(item => item.data().userId === uid).map(item => ({ ...item.data(), id: item.id })),
    decks: decks.docs.filter(item => item.data().userId === uid && item.data().type === 'deck').map(item => ({ ...item.data(), id: item.id })),
    profile: profile ? normalizeIdentity({ ...profile, showcases: Object.fromEntries(showcases.docs.map(item => [item.id, item.data().items])) }) : null,
  };
}
