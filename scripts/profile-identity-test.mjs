import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const url = text => `data:text/javascript;base64,${Buffer.from(compile(text)).toString('base64')}`;
const identity = await import(url(await readFile(new URL('../services/profile-identity.ts', import.meta.url), 'utf8')));
const favorite = { id: 'anilist:20', title: 'Naruto', source: 'anilist', kind: 'anime', imageUrl: 'https://s4.anilist.co/example.jpg' };
test('combined favorite media preserves both catalogues and respects hidden modules', () => {
  const value = identity.defaultIdentity(); value.mediaLayout = 'combined';
  value.showcases.anime = [favorite];
  value.showcases.vn = [{ ...favorite, id: 'vndb:v11', source: 'vndb', kind: 'vn' }];
  assert.equal(identity.profileShowcase(value, 'anime').title, 'Favorite media');
  assert.equal(identity.profileShowcase(value, 'anime').items.length, 2);
  assert.equal(identity.profileShowcase(value, 'vn').hidden, true);
  value.modules = ['vn', 'characters'];
  assert.equal(identity.profileShowcase(value, 'vn').hidden, false);
  assert.equal(identity.profileShowcase(value, 'vn').items.length, 1);
  value.mediaLayout = 'separate';
  assert.deepEqual(identity.profileShowcase(value, 'anime').items, [favorite]);
  assert.equal(identity.normalizeIdentity({ mediaLayout: 'invalid' }).mediaLayout, 'separate');
});
const bind = async (path, bindings, exports) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const body = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast).replace(/^export /, '')).join('\n');
  return new Function(...Object.keys(bindings), `${compile(body)}; return {${exports}};`)(...Object.values(bindings));
};
test('identity normalization rejects unsafe URLs, malformed favorites and private fields', () => {
  const value = identity.normalizeIdentity({ accent: '__proto__', bio: 'x'.repeat(2200), privateSettings: { email: 'secret' }, avatar: { url: 'javascript:alert(1)', zoom: 99 }, modules: ['bio', 'bio', 'journal'], showcases: { anime: [favorite, favorite, { ...favorite, source: 'vndb' }, { ...favorite, id: 'anilist:3', title: '' }] } });
  assert.equal(value.accent, 'cyan'); assert.equal(value.bio.length, 2000); assert.equal(value.avatar.url, ''); assert.equal(value.avatar.zoom, 3);
  assert.deepEqual(value.modules, ['bio']); assert.deepEqual(value.showcases.anime, [favorite]); assert.equal(value.privateSettings, undefined);
  for (const value of ['https://s4.anilist.co.evil.test/a', 'https://user:secret@s4.anilist.co/a', 'https://s4.anilist.co:1234/a', 'data:image/svg+xml,a']) assert.equal(identity.safeArtwork(value), false);
  assert.equal(identity.validShowcaseId('vndb:c1', 'vndb', 'characters'), true);
  assert.equal(identity.validShowcaseId('vndb:v1', 'vndb', 'characters'), false);
});
test('public projection never carries journal, routes, private tags or sharing preferences', () => {
  assert.deepEqual(identity.publicLibraryEntry({ kitsuId: '20', title: 'Naruto', status: 'watching', watchedEpisodes: 4, notes: 'secret', personalTags: ['secret'], routes: ['secret'], shareNoteActivity: false }), { kitsuId: '20', title: 'Naruto', status: 'watching', watchedEpisodes: 4 });
  assert.deepEqual(identity.publicLibraryEntry({ title: { notes: 'secret' }, genres: ['Action', { notes: 'secret' }], updatedAt: { notes: 'secret' }, score: NaN }), { genres: ['Action'] });
});
test('bio escapes HTML and keeps spoilers closed', async () => {
  const { ProfileBio } = await bind('../features/ProfileBio.tsx', { React }, 'ProfileBio');
  const html = renderToStaticMarkup(React.createElement(ProfileBio, { text: '**Bold** *Italic* ||Secret ending|| <img src=x onerror=alert(1)>' }));
  assert.match(html, /<strong>Bold<\/strong>/); assert.match(html, /<em>Italic<\/em>/);
  assert.match(html, /<details/); assert.doesNotMatch(html, /<details[^>]*open|<img|<script/);
  assert.match(html, /&lt;img/);
});
test('profile save commits identity and showcases atomically, removes replaced files, protects active uploads', async () => {
  const writes = [], removed = [], objects = ['old', 'current', 'recent', 'orphan'].map(name => ({ fullPath: `profile-images/owner/${name}.webp` }));
  const current = { revision: 2, avatar: { path: objects[0].fullPath }, banner: { path: '' } };
  const draft = identity.defaultIdentity(); draft.showcases.anime = [favorite];
  const bindings = { ...identity, crypto: { randomUUID: () => 'current' }, getStorage: () => ({}), ref: (_storage, fullPath) => ({ fullPath }), doc: (...args) => args.slice(1).join('/'), uploadBytes: async () => {}, getDownloadURL: async () => 'https://firebasestorage.googleapis.com/v0/b/demo/o/profile-images%2Fowner%2Fcurrent.webp?alt=media',
    runTransaction: async (_db, action) => action({ get: async () => ({ data: () => current }), set: (...args) => writes.push(args) }),
    getDocFromServer: async () => ({ data: () => ({ avatar: { path: objects[1].fullPath }, banner: { path: '' } }) }),
    listAll: async () => ({ items: objects }), getMetadata: async object => ({ timeCreated: new Date(Date.now() - (object.fullPath.includes('orphan') ? 7200000 : 1000)).toISOString() }), deleteObject: async object => removed.push(object.fullPath),
  };
  const { saveProfileIdentity } = await bind('../services/profile-storage.ts', bindings, 'saveProfileIdentity');
  const result = await saveProfileIdentity({ app: {} }, 'test', 'owner', draft, { avatar: new Blob(['test']) }, 2);
  assert.equal(result.revision, 3); assert.equal(result.cleanupPending, false); assert.equal(writes.length, 4);
  assert.equal(writes[0][1].showcases, undefined); assert.deepEqual(writes[1][1].items, [favorite]);
  assert.deepEqual(removed, [objects[0].fullPath, objects[3].fullPath]);
  writes.length = 0; removed.length = 0;
  await assert.rejects(saveProfileIdentity({ app: {} }, 'test', 'owner', draft, { avatar: new Blob(['test']) }, 1), /another window/);
  assert.equal(writes.length, 0); assert.deepEqual(removed, [objects[1].fullPath]);
});
