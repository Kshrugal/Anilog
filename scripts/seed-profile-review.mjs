// Isolated demo data only. Never accepts a production project ID or credentials.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
const projectId = 'demo-anilog';
const credentials = { email: 'review@anilog.local', password: 'AnilogReview123!', returnSecureToken: true };
async function auth(action) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-anilog-local`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
  return response.json();
}
let account = await auth('signUp');
if (account.error?.message === 'EMAIL_EXISTS') account = await auth('signInWithPassword');
if (!account.localId) throw new Error('Local Auth emulator is unavailable.');
const response = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{Page{media(id_in:[20,16498,1998],type:ANIME){id title{romaji} coverImage{large} bannerImage episodes duration}}}' }) });
const media = (await response.json()).data?.Page?.media;
if (!media?.length) throw new Error('Unable to load public catalogue artwork for the review fixtures.');
const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080 } });
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), base = `artifacts/${projectId}/public/data/users/${account.localId}`;
    await setDoc(doc(db, base), { uid: account.localId, username: 'Phase Two Review', libraryPublic: true, friends: [], hallOfFame: [] });
    for (const item of media) await setDoc(doc(db, `${base}/animeList/anilist:${item.id}`), { kitsuId: `anilist:${item.id}`, title: item.title.romaji, imageUrl: item.coverImage.large, totalEpisodes: item.episodes, durationMinutes: item.duration, watchedEpisodes: 3, status: 'watching', provider: 'anilist', mediaType: 'anime', score: 8, notes: 'LOCAL PRIVATE JOURNAL FIXTURE - never visible to visitors' });
  });
  console.log(`Local review ready: http://127.0.0.1:5175/\nAccount: ${credentials.email}\nPassword: ${credentials.password}\nDemo UID: ${account.localId}`);
} finally { await env.cleanup(); }
