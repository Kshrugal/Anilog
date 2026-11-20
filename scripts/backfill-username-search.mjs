import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';

const { FIREBASE_PROJECT_ID: projectId, FIREBASE_APP_ID: appId, CONFIRM_USERNAME_BACKFILL: confirmation } = process.env;
if (!projectId || !appId || confirmation !== projectId || appId.includes('/')) {
  throw new Error('Expected explicit project confirmation and the AniLog app ID.');
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const profiles = db.collection(`artifacts/${appId}/public/data/users`);
let cursor;
let scanned = 0;
let updated = 0;
while (true) {
  const listing = profiles.orderBy(FieldPath.documentId()).select('username', 'usernameSearch').limit(250);
  const page = await (cursor ? listing.startAfter(cursor) : listing).get();
  if (page.empty) break;
  scanned += page.size;
  const batch = db.batch();
  let size = 0;
  for (const profile of page.docs) {
    const name = profile.get('username');
    if (typeof name !== 'string' || !name.trim() || name.length > 80) continue;
    const usernameSearch = name.trim().toLowerCase();
    if (profile.get('usernameSearch') === usernameSearch) continue;
    batch.update(profile.ref, { usernameSearch }, { lastUpdateTime: profile.updateTime });
    size++;
  }
  if (size) await batch.commit();
  updated += size;
  cursor = page.docs.at(-1);
}
console.log(`Scanned ${scanned} profiles; indexed ${updated} usernames.`);
