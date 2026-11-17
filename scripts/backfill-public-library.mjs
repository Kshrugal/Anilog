import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

const projectId = process.env.FIREBASE_PROJECT_ID;
const appId = process.env.FIREBASE_APP_ID;
if (!projectId || !appId || process.env.CONFIRM_PROFILE_MIGRATION !== projectId) throw new Error('Explicit project confirmation required.');
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const source = await readFile(new URL('../services/profile-identity.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { publicLibraryEntry } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const profiles = await db.collection(`artifacts/${appId}/public/data/users`).get();
const allowed = ['uid', 'username', 'createdAt', 'friends', 'hallOfFame', 'libraryPublic', 'email'];
// Audit every public profile before making any changes. Unknown fields are not discarded.
for (const profile of profiles.docs) {
  const value = profile.data();
  if (Object.keys(value).some(key => !allowed.includes(key)) || value.uid !== profile.id || typeof value.username !== 'string' || !value.username.length || value.username.length > 80) {
    throw new Error('Public profile schema audit failed. No migration performed. Review legacy records privately.');
  }
}
let entries = 0;
for (const profile of profiles.docs) {
  const privateEntries = await profile.ref.collection('animeList').get();
  const existing = await profile.ref.collection('publicLibrary').get();
  const desired = new Map(privateEntries.docs.map(item => [item.id, publicLibraryEntry({ kitsuId: item.id, ...item.data() })]));
  for (const value of desired.values()) if (typeof value.kitsuId !== 'string' || typeof value.title !== 'string' || !['watching', 'reading', 'completed', 'planned', 'planning', 'paused', 'on_hold', 'dropped'].includes(value.status)) throw new Error('Library schema audit failed. Original library is unchanged.');
  const changes = [...desired].map(([id, data]) => ({ id, data }));
  for (const item of existing.docs) if (!desired.has(item.id)) changes.push({ id: item.id, data: null });
  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch();
    for (const item of changes.slice(i, i + 400)) {
      const ref = profile.ref.collection('publicLibrary').doc(item.id);
      if (item.data) batch.set(ref, item.data); else batch.delete(ref);
    }
    await batch.commit();
  }
  if ('email' in profile.data()) await profile.ref.update({ email: FieldValue.delete() });
  entries += desired.size;
}
console.log(`Audited ${profiles.size} public profiles; published ${entries} sanitized library entries. Original libraries unchanged.`);
