import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../services/account-export.ts', import.meta.url), 'utf8');
const body = ts.transpile(source.replace(/^import .*\n/gm, '').replace(/^export /gm, ''), { target: ts.ScriptTarget.ES2022 });
const owner = { uid: 'owner', isAnonymous: false };
const auth = { currentUser: owner };
const reads = [];
let revision = 3;
let signOutOnRead = false;
let offline = false;
const entry = (id, data) => ({ id, data: () => data });
const load = runInNewContext(body + '\nloadAccountExport;', {
  getAuth: () => auth, collection: (_, path) => path, doc: (_, path) => path,
  query: (path, filter) => ({ path, filter }), where: (...args) => args,
  normalizeIdentity: ({ showcases }) => ({ showcases }),
  getDocFromServer: async path => { reads.push(path); return entry('owner', { revision: 3 }); },
  getDocsFromServer: async ref => {
    reads.push(ref);
    if (signOutOnRead) auth.currentUser = null;
    if (offline) throw new Error('Offline');
    if (ref === 'showcases') return { docs: [entry('anime', { revision, items: ['favorite'] })] };
    if (typeof ref === 'string') return { docs: [entry('title', { notes: 'private note' })] };
    assert.deepEqual(Array.from(ref.filter), ['userId', '==', 'owner']);
    return { docs: [entry('own', { userId: 'owner', type: 'deck' }), entry('foreign', { userId: 'other', type: 'deck' })] };
  },
});
const db = { app: {} };
await assert.rejects(load(db, 'demo', 'other'), /Sign in again/);
assert.equal(reads.length, 0);
auth.currentUser = { ...owner, isAnonymous: true };
await assert.rejects(load(db, 'demo', 'owner'), /Sign in again/);
assert.equal(reads.length, 0);
auth.currentUser = owner;
const result = await load(db, 'demo', 'owner');
assert.equal(result.library[0].notes, 'private note');
assert.equal(result.library[0].id, 'title');
assert.deepEqual(Array.from(result.activity, item => item.id), ['own']);
assert.deepEqual(Array.from(result.decks, item => item.id), ['own']);
assert.deepEqual(Array.from(result.profile.showcases.anime), ['favorite']);
assert.ok(reads.includes('artifacts/demo/public/data/users/owner/animeList'));
revision = 2;
await assert.rejects(load(db, 'demo', 'owner'), /profile changed/);
revision = 3;
offline = true;
await assert.rejects(load(db, 'demo', 'owner'), /Offline/);
offline = false;
signOutOnRead = true;
await assert.rejects(load(db, 'demo', 'owner'), /Sign in again/);
console.log('Account export ownership, server failures, session changes, and showcase revision checks passed.');
