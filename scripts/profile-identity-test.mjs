import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { Check } from 'lucide-react';

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
test('profile crop batches pointer updates, clamps focus, and cancels pending work on close', async () => {
  const scheduled = new Map(), changes = [], cleanups = [];
  let sequence = 0;
  const { ProfileImageEditor } = await bind('../features/ProfileImageEditor.tsx', {
    React, useState: value => [value, () => {}], useRef: value => ({ current: value }),
    useEffect: action => { const cleanup = action(); if (cleanup) cleanups.push(cleanup); },
    requestAnimationFrame: action => { scheduled.set(++sequence, action); return sequence; },
    cancelAnimationFrame: id => scheduled.delete(id),
    IdentityImage: 'img', ImagePlus: 'i', RotateCcw: 'i', Trash2: 'i', Upload: 'i', UserRound: 'i',
  }, 'ProfileImageEditor');
  const element = ProfileImageEditor({ kind: 'avatar', image: identity.emptyImage(), hasImage: true, enabled: true, onChange: image => changes.push(image), onUpload() {}, onRemove() {} });
  const find = node => React.isValidElement(node) ? node.props.onPointerDown ? node : React.Children.toArray(node.props.children).map(find).find(Boolean) : null;
  const crop = find(element);
  crop.props.onPointerDown({ clientX: 100, clientY: 100, pointerId: 1, preventDefault() {}, currentTarget: { getBoundingClientRect: () => ({ width: 200, height: 200 }), setPointerCapture() {} } });
  for (let i = 1; i <= 20; i++) crop.props.onPointerMove({ clientX: 100 + i, clientY: 100 - i });
  assert.equal(scheduled.size, 1); assert.equal(changes.length, 0);
  scheduled.values().next().value();
  assert.deepEqual(changes.map(image => [image.x, image.y]), [[40, 60]]);
  crop.props.onPointerMove({ clientX: 1000, clientY: -1000 });
  crop.props.onPointerUp();
  assert.deepEqual(changes.at(-1), { ...identity.emptyImage(), x: 0, y: 100 });
  assert.equal(scheduled.size, 0);
  crop.props.onPointerMove({ clientX: 0, clientY: 0 });
  assert.equal(scheduled.size, 0);
  cleanups.forEach(cleanup => cleanup());
});
test('upload preparation validates inputs, downsizes large images, and releases image memory', async () => {
  let closed = 0, drawn = 0, outputType = 'image/webp';
  const bitmap = { width: 4096, height: 2048, close() { closed++; } };
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() { drawn++; } }), toBlob: callback => callback(new Blob(['image'], { type: outputType })) };
  const { prepareProfileImage } = await bind('../services/profile-storage.ts', {
    createImageBitmap: async () => bitmap, document: { createElement: () => canvas },
  }, 'prepareProfileImage');
  for (const input of [{ type: 'image/svg+xml', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: 9 * 1024 * 1024 }]) await assert.rejects(prepareProfileImage(input), /JPEG, PNG, or WebP/);
  const image = await prepareProfileImage({ type: 'image/png', size: 100 });
  assert.equal(image.type, 'image/webp'); assert.equal(canvas.width, 2048); assert.equal(canvas.height, 1024); assert.equal(drawn, 1); assert.equal(closed, 1);
  outputType = 'image/png';
  await assert.rejects(prepareProfileImage({ type: 'image/png', size: 100 }), /does not support WebP/);
  assert.equal(closed, 2);
  bitmap.width = bitmap.height = 10000;
  await assert.rejects(prepareProfileImage({ type: 'image/png', size: 100 }), /dimensions/);
  assert.equal(closed, 3);
});
test('combined layout visibility and ordering move media as one section', async () => {
  const { profileLayoutRows, toggleProfileModule, moveProfileModule } = await bind('../services/profile-layout.ts', identity, 'profileLayoutRows,toggleProfileModule,moveProfileModule');
  const value = { ...identity.defaultIdentity(), mediaLayout: 'combined' };
  assert.deepEqual(profileLayoutRows(value), ['bio', 'progress', 'anime', 'characters', 'activity']);
  assert.deepEqual(moveProfileModule(value, 'anime', -1), ['bio', 'anime', 'vn', 'progress', 'characters', 'activity']);
  assert.deepEqual(toggleProfileModule(value, 'anime', false), ['bio', 'progress', 'characters', 'activity']);
  assert.deepEqual(toggleProfileModule({ ...value, modules: ['bio', 'characters'] }, 'anime', true), ['bio', 'characters', 'anime', 'vn']);
  assert.deepEqual(moveProfileModule(value, 'bio', -1), value.modules);
});
test('favorite character search preserves both catalogues and filters unsafe artwork', async () => {
  const profile = await import(url(await readFile(new URL('../services/profile.ts', import.meta.url), 'utf8')));
  const calls = [];
  const fetch = async (endpoint, options) => {
    calls.push({ endpoint, body: JSON.parse(options.body), signal: options.signal });
    if (endpoint.includes('anilist')) return { ok: true, json: async () => ({ data: { Page: { characters: [{ id: 1, name: { full: 'Naruto' }, image: { large: 'https://s4.anilist.co/naruto.jpg' } }, { id: 2, name: { full: 'Unsafe' }, image: { large: 'javascript:alert(1)' } }] } } }) };
    return { ok: true, json: async () => ({ results: [
      { id: 'c1', name: 'Safe', image: { url: 'https://t.vndb.org/safe.jpg', sexual: 0, violence: 0 } },
      { id: 'c3', name: 'Explicit', image: { url: 'https://t.vndb.org/explicit.jpg', sexual: 2, violence: 0 } },
    ] }) };
  };
  const { searchProfileArtwork } = await bind('../services/profile-artwork.ts', { ...identity, ...profile, fetch }, 'searchProfileArtwork');
  const signal = new AbortController().signal;
  assert.equal((await searchProfileArtwork('Naruto', 'characters', 'anilist', signal)).length, 1);
  assert.deepEqual(calls[0].body.variables, { search: 'Naruto' });
  const characters = await searchProfileArtwork('Safe', 'characters', 'vndb', signal);
  assert.deepEqual(characters.map(item => item.id), ['vndb:c1']);
  assert.deepEqual(calls[1].body.filters, ['search', '=', 'Safe']);
  assert.ok(calls.every(call => call.signal instanceof AbortSignal));
  assert.deepEqual(await searchProfileArtwork('  ', 'characters', 'anilist', signal), []);
  assert.equal(calls.length, 2);
});
test('artwork choices expose selected state, duplicate prevention and safe title text', async () => {
  const { ArtworkGrid } = await bind('../features/ProfileArtworkPicker.tsx', { React, Check }, 'ArtworkGrid');
  const html = renderToStaticMarkup(React.createElement(ArtworkGrid, { items: [{ ...favorite, title: '<script>unsafe</script>' }], selected: [favorite.id], onSelect() {} }));
  assert.match(html, /aria-pressed="true"/); assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});
test('anime cast lookup uses the selected AniList work and returns shared character identities', async () => {
  const calls = [];
  const fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ data: { Media: { characters: {
      nodes: [
        { id: 1, name: { full: 'Naruto' }, image: { large: 'https://s4.anilist.co/naruto.jpg' } },
        { id: 2, name: { full: 'Missing art' } },
      ], pageInfo: { hasNextPage: true },
    } } } }) };
  };
  const { getAnimeCast } = await bind('../services/profile-artwork.ts', { ...identity, fetch }, 'getAnimeCast');
  const signal = new AbortController().signal;
  const cast = await getAnimeCast('anilist:20', 2, signal);
  assert.deepEqual(calls[0].variables, { id: 20, page: 2 });
  assert.match(calls[0].query, /Media\(id: \$id, type: ANIME/);
  assert.equal(cast.hasNextPage, true);
  assert.deepEqual(cast.items.map(item => [item.id, item.kind]), [['anilist:1', 'characters']]);
  await assert.rejects(getAnimeCast('vndb:v20', 1, signal), /Choose an anime from AniList/);
  assert.equal(calls.length, 1);
});
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
