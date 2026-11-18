import { readFile } from 'node:fs/promises';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const projectId = process.env.FIREBASE_PROJECT_ID;
const bucket = process.env.FIREBASE_STORAGE_BUCKET;
if (projectId !== 'anilog-10335' || bucket !== 'anilog-10335.firebasestorage.app') {
  throw new Error('Refusing to deploy outside the existing Anilog image bucket.');
}
const app = initializeApp({ credential: applicationDefault(), projectId, storageBucket: bucket });
const source = await readFile(new URL('../storage.rules', import.meta.url), 'utf8');
const rules = getSecurityRules(app);
const firestore = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
await rules.releaseFirestoreRulesetFromSource(firestore);
const deployedFirestore = await rules.getFirestoreRuleset();
if (!deployedFirestore.source.some(file => file.content === firestore)) throw new Error('Firestore rules verification failed.');
console.log('Anilog Firestore rules deployed and verified.');
if (process.env.DEPLOY_STORAGE_RULES === 'true') {
  await rules.releaseStorageRulesetFromSource(source, bucket);
  const deployed = await rules.getStorageRuleset(bucket);
  if (!deployed.source.some(file => file.content === source)) throw new Error('Storage rules verification failed.');
  console.log('Anilog profile image rules deployed and verified.');
}
