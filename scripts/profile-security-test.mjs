import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';

const projectId = 'demo-anilog';
const env = await initializeTestEnvironment({ projectId,
  firestore: { host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  storage: { host: '127.0.0.1', port: 9199, rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8') },
});
const root = 'artifacts/demo-anilog/public/data';
const owner = env.authenticatedContext('owner'), stranger = env.authenticatedContext('stranger'), guest = env.unauthenticatedContext();
const image = { url: '', path: '', x: 50, y: 50, zoom: 1 };
const identity = { version: 1, revision: 1, bio: '**Hello** ||spoiler||', accent: 'cyan', bannerMode: 'collage', avatar: image, banner: image, modules: ['bio', 'progress', 'anime', 'vn', 'characters', 'activity'] };
const identityPath = `${root}/profileIdentity/owner`;
const userPath = `${root}/users/owner`;
let assertions = 0;
const allowed = async promise => { await assertSucceeds(promise); assertions++; };
const denied = async promise => { await assertFails(promise); assertions++; };
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `${root}/users/legacy`), { uid: 'legacy', username: 'Legacy', top10: ['preserved'], bannerUrl: 'https://example.test/legacy.jpg', streak: 3, lastLogin: 1 });
    await deleteDoc(doc(db, identityPath));
    for (const item of (await getDocs(collection(db, `${identityPath}/showcases`))).docs) await deleteDoc(item.ref);
    await setDoc(doc(db, userPath), { uid: 'owner', username: 'Owner', libraryPublic: true });
    await setDoc(doc(db, `${userPath}/animeList/anilist:20`), { kitsuId: 'anilist:20', title: 'Naruto', status: 'completed', notes: 'PRIVATE JOURNAL SECRET', personalTags: ['private'] });
    await setDoc(doc(db, `artifacts/demo-anilog/privateUsers/owner/journal/entry`), { notes: 'secret' });
  });
  for (const context of [guest, stranger]) {
    await denied(getDoc(doc(context.firestore(), `${userPath}/animeList/anilist:20`)));
    await denied(getDocs(collection(context.firestore(), `${userPath}/animeList`)));
    await denied(getDoc(doc(context.firestore(), 'artifacts/demo-anilog/privateUsers/owner/journal/entry')));
    await denied(getDoc(doc(context.firestore(), 'artifacts/demo-anilog/privateUsers/owner/settings/appearance')));
    await denied(setDoc(doc(context.firestore(), identityPath), identity));
  }
  await allowed(getDoc(doc(owner.firestore(), `${userPath}/animeList/anilist:20`)));
  const legacy = env.authenticatedContext('legacy').firestore();
  await allowed(updateDoc(doc(legacy, `${root}/users/legacy`), { libraryPublic: true }));
  await denied(updateDoc(doc(legacy, `${root}/users/legacy`), { top10: ['changed'] }));
  await denied(updateDoc(doc(owner.firestore(), userPath), { streak: 9 }));
  await allowed(setDoc(doc(env.authenticatedContext('new-user').firestore(), `${root}/users/new-user`), { uid: 'new-user', username: 'New user', libraryPublic: false }));
  await allowed(setDoc(doc(owner.firestore(), `${userPath}/publicLibrary/anilist:20`), { kitsuId: 'anilist:20', title: 'Naruto', status: 'completed' }));
  await denied(updateDoc(doc(owner.firestore(), `${userPath}/publicLibrary/anilist:20`), { notes: 'leak' }));
  await denied(updateDoc(doc(owner.firestore(), `${userPath}/publicLibrary/anilist:20`), { personalTags: ['leak'] }));
  await allowed(getDocs(collection(guest.firestore(), `${userPath}/publicLibrary`)));
  await allowed(updateDoc(doc(owner.firestore(), userPath), { libraryPublic: false }));
  await denied(getDoc(doc(guest.firestore(), `${userPath}/publicLibrary/anilist:20`)));
  await denied(getDocs(collection(stranger.firestore(), `${userPath}/publicLibrary`)));
  await denied(updateDoc(doc(stranger.firestore(), userPath), { libraryPublic: true }));
  await allowed(setDoc(doc(owner.firestore(), identityPath), identity));
  await allowed(getDoc(doc(guest.firestore(), identityPath)));
  await denied(updateDoc(doc(owner.firestore(), identityPath), { revision: 2, privateSettings: {} }));
  for (const patch of [{ bio: 'x'.repeat(2001) }, { accent: 'url(evil)' }, { modules: ['bio', 'bio'] }, { modules: ['journal'] }, { avatar: { ...image, zoom: 99 } }, { banner: { ...image, url: 'javascript:alert(1)' } }, { avatar: { ...image, url: 'https://s4XanilistXco/evil' } }, { avatar: { ...image, path: 'profile-images/stranger/abc.webp', url: 'https://firebasestorage.googleapis.com/v0/b/demo-anilog.appspot.com/o/profile-images%2Fstranger%2Fabc.webp?alt=media' } }]) {
    await denied(updateDoc(doc(owner.firestore(), identityPath), { ...patch, revision: 2 }));
  }
  const favorite = { id: 'anilist:20', title: 'Naruto', source: 'anilist', kind: 'anime', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20.jpg' };
  await denied(updateDoc(doc(owner.firestore(), identityPath), { revision: 2, mediaLayout: 'invalid' }));
  await allowed(updateDoc(doc(owner.firestore(), identityPath), { revision: 2, mediaLayout: 'combined' }));
  await denied(updateDoc(doc(owner.firestore(), identityPath), { revision: 2 }));
  const showcasePath = `${identityPath}/showcases/anime`;
  await allowed(setDoc(doc(owner.firestore(), showcasePath), { revision: 2, items: [favorite] }));
  await allowed(getDoc(doc(guest.firestore(), showcasePath)));
  await denied(setDoc(doc(stranger.firestore(), showcasePath), { revision: 2, items: [favorite] }));
  for (const items of [Array(9).fill(favorite), [{ ...favorite, notes: 'private' }], [{ ...favorite, source: 'vndb' }]]) {
    await denied(setDoc(doc(owner.firestore(), showcasePath), { revision: 2, items }));
  }
  const full = {
    anime: Array.from({ length: 8 }, (_, i) => ({ ...favorite, id: `anilist:${i + 1}` })),
    vn: Array.from({ length: 8 }, (_, i) => ({ ...favorite, id: `vndb:v${i + 1}`, source: 'vndb', kind: 'vn' })),
    characters: Array.from({ length: 8 }, (_, i) => ({ ...favorite, id: `anilist:${i + 1}`, kind: 'characters' })),
  };
  const batch = writeBatch(owner.firestore());
  batch.update(doc(owner.firestore(), identityPath), { revision: 3 });
  for (const [kind, items] of Object.entries(full)) batch.set(doc(owner.firestore(), `${identityPath}/showcases/${kind}`), { revision: 3, items });
  await allowed(batch.commit());
  await denied(setDoc(doc(owner.firestore(), showcasePath), { revision: 2, items: [] }));
  const appearance = { themeId: 'neon', viewMode: 'grid', density: 'comfortable', showTrail: true, showQuickTip: true, sidebarCollapsed: false };
  await allowed(setDoc(doc(owner.firestore(), 'artifacts/demo-anilog/privateUsers/owner/settings/appearance'), appearance));
  await denied(updateDoc(doc(owner.firestore(), userPath), { settings: appearance }));
  const path = 'profile-images/owner/test.webp';
  await allowed(owner.storage().ref(path).put(new Uint8Array([1, 2, 3]), { contentType: 'image/webp' }));
  await allowed(guest.storage().ref(path).getDownloadURL());
  await denied(guest.storage().ref('profile-images/owner').listAll());
  await denied(stranger.storage().ref('profile-images/owner/other.webp').put(new Uint8Array([1]), { contentType: 'image/webp' }));
  await denied(guest.storage().ref('profile-images/owner/guest.webp').put(new Uint8Array([1]), { contentType: 'image/webp' }));
  await denied(owner.storage().ref('profile-images/owner/invalid.webp').put(new Uint8Array([1]), { contentType: 'image/svg+xml' }));
  await denied(owner.storage().ref('profile-images/owner/huge.webp').put(new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/webp' }));
  await denied(owner.storage().ref(path).put(new Uint8Array([4]), { contentType: 'image/webp' }));
  await denied(stranger.storage().ref(path).delete());
  await allowed(owner.storage().ref(path).delete());
  assert.ok(assertions >= 40);
  console.log(`${assertions} security assertions passed against local Firestore and Storage emulators.`);
} finally { await env.cleanup(); }
