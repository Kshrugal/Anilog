import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const source = await readFile(new URL('../services/profile.ts', import.meta.url), 'utf8');
const helpers = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`);
const { profileEntry, profileLibrary, profileMediaId, profileProgress } = helpers;
const pagesSource = await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8');
const pages = ts.createSourceFile('Pages.tsx', pagesSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = pages.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'UserProfilePage');
const effects = component.body.statements.filter(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(pages) === 'useEffect');
function evaluate(node, bindings) {
  return new Function(...Object.keys(bindings), `${compile(`const value = ${node.getText(pages)};`)}\nreturn value;`)(...Object.values(bindings));
}
function handler(name, bindings) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(pages) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(component);
  assert.ok(found, name);
  return evaluate(found, bindings);
}
const entries = [
  { id: '1', title: 'Anime A', status: 'watching', updatedAt: 10, score: 7 },
  { id: 'v1', title: '\u591c\u7a7a', status: 'reading', updatedAt: { seconds: 2 }, score: 9 },
  { id: '2', title: 'Anime B', status: 'planning', updatedAt: '2020-01-01' },
  { id: 'v2', title: 'Novel B', status: 'on_hold' },
  { id: '3', title: 'Anime C', status: 'completed' },
  { id: 'v3', title: 'Novel C', status: 'dropped' },
].map(profileEntry);

test('public tiles only add a fallback when the shared card has no progress caption', () => {
  let fallback;
  const visit = node => {
    if (ts.isConditionalExpression(node) && node.condition.getText(pages) === 'profileIsVn(a)' && node.whenFalse.getText(pages).includes('totalEpisodes')) fallback = node;
    ts.forEachChild(node, visit);
  };
  visit(component);
  assert.ok(fallback);
  const check = a => evaluate(fallback, { a, ...helpers });
  assert.equal(check({ totalEpisodes: 12, watchedEpisodes: 3 }), false);
  assert.equal(check({ id: 'v1', watchedEpisodes: 5 }), false);
  assert.equal(check({ id: 'v1', watchedEpisodes: 0 }), true);
  assert.equal(check({ watchedEpisodes: 4 }), true);
});

test('all media and statuses include legacy planning, on_hold, reading and VN ID fallback', () => {
  assert.deepEqual(profileLibrary(entries).counts, { all: 6, watching: 2, completed: 1, planned: 1, paused: 1, dropped: 1 });
  assert.equal(entries[1].mediaType, 'vn');
  assert.equal(entries[1].kitsuId, 'v1');
  assert.equal(profileMediaId({ vnId: 'v42', id: 'document' }), 'v42');
  assert.equal(profileLibrary(entries, 'anime').items.length, 3);
  assert.equal(profileLibrary(entries, 'vn', 'watching').items[0].id, 'v1');
  assert.equal(profileLibrary(entries, 'all', 'paused').items[0].id, 'v2');
});

test('Unicode search preserves non-Latin differences and handles canonical/full-width titles', () => {
  assert.equal(profileLibrary(entries, 'all', 'all', '\u591c').items[0].id, 'v1');
  assert.equal(profileLibrary(entries, 'all', 'all', '\u661f').items.length, 0);
  assert.equal(profileLibrary(entries, 'all', 'all', '\uff21\uff2e\uff29\uff2d\uff25- A').items[0].id, '1');
  assert.equal(profileLibrary([{ canonicalTitle: 'Test title' }], 'all', 'all', 'test').items.length, 1);
  assert.equal(profileLibrary(entries, 'anime', 'completed', 'Anime').counts.watching, 1);
});

test('sorts timestamp shapes, title and score without mutating saved entries', () => {
  const original = [...entries];
  assert.equal(profileLibrary(entries).items[0].id, '2');
  assert.equal(profileLibrary(entries, 'all', 'all', '', 'score').items[0].id, 'v1');
  assert.equal(profileLibrary(entries, 'all', 'all', '', 'title').items[0].title, 'Anime A');
  assert.deepEqual(entries, original);
});

test('progress covers unknown totals, zero, VN percent and bounds', () => {
  assert.equal(profileProgress({ id: 'v1', watchedEpisodes: 120 }), '100% read');
  assert.equal(profileProgress({ watchedEpisodes: 4, totalEpisodes: 12 }), '4 / 12 eps');
  assert.equal(profileProgress({ watchedEpisodes: -2 }), '0 / ? eps');
  assert.equal(profileProgress({ id: 'v1' }), '0% read');
});

const snapshot = data => ({ exists: () => data !== undefined, data: () => data });
const flush = () => new Promise(resolve => setImmediate(resolve));
function boundary(overrides = {}) {
  const state = {};
  const reads = [];
  const bindings = {
    ...helpers, db: {}, appId: 'test', targetUid: 'friend', targetUsername: 'Friend', currentUserId: 'me', readOnly: false, visitorPreview: false, visitor: true,
    tab: 'overview', loading: false, libraryPrivate: false, loadError: '', friendBusy: false, isFriend: false,
    doc: (_db, path) => path, collection: (_db, path) => path, query: path => path, where: () => {}, orderBy: () => {}, limit: () => {},
    getDoc: async path => { reads.push(path); return snapshot({ libraryPublic: true }); },
    getDocs: async path => { reads.push(path); if (path.endsWith('/activity')) throw new Error('Missing composite index'); return { docs: [{ id: 'v1', data: () => ({ title: 'Saved', status: 'reading' }) }] }; },
    console: { error() {} }, showToast() {},
  };
  for (const match of component.getText(pages).matchAll(/\b(set[A-Z]\w*)\(/g)) {
    if (match[1] !== 'setPage') bindings[match[1]] = value => { state[match[1]] = value; };
  }
  return { state, reads, bindings: { ...bindings, ...overrides } };
}

test('activity index failure cannot block library; own library is not read for overview', async () => {
  const { state, reads, bindings } = boundary();
  evaluate(effects[0].expression.arguments[0], bindings)();
  await flush();
  assert.equal(state.setLoading, false);
  assert.equal(state.setList[0].kitsuId, 'v1');
  assert.equal(state.setActivityError, 'Recent activity is unavailable.');
  assert.equal(reads.some(path => path.endsWith('/me/animeList')), false);
});

test('private profile never requests library, guests never request own profile or comparison', async () => {
  const privateState = boundary({ getDoc: async () => snapshot({ libraryPublic: false }) });
  evaluate(effects[0].expression.arguments[0], privateState.bindings)();
  await flush();
  assert.equal(privateState.state.setLibraryPrivate, true);
  assert.equal(privateState.reads.some(path => path.endsWith('/animeList')), false);
  const guest = boundary({ readOnly: true, tab: 'compare' });
  evaluate(effects[0].expression.arguments[0], guest.bindings)();
  evaluate(effects[1].expression.arguments[0], guest.bindings)();
  await handler('handleFriendAction', guest.bindings)();
  await flush();
  assert.equal(guest.reads.some(path => path.includes('/me')), false);
});

test('comparison loads own library only when requested; canceled target fetch cannot repopulate state', async () => {
  const compare = boundary({ tab: 'compare' });
  evaluate(effects[1].expression.arguments[0], compare.bindings)();
  await flush();
  assert.ok(compare.reads.some(path => path.endsWith('/me/animeList')));
  let resolve;
  const stale = boundary({ getDoc: () => new Promise(done => { resolve = done; }), readOnly: true });
  const cleanup = evaluate(effects[0].expression.arguments[0], stale.bindings)();
  cleanup();
  resolve(snapshot({}));
  await flush();
  assert.deepEqual(stale.state.setList, []);
  assert.equal(stale.state.setSelectedAnimeData, null);
  assert.equal(stale.state.setStatus, 'all');
  assert.equal(stale.state.setSearchQuery, '');
  for (const effect of effects) assert.equal(effect.expression.arguments[1].getText(pages).includes('targetUser,'), false);
});

test('saved selection opens synchronously with target ownership; Hall of Fame uses immediate fallback', () => {
  const saved = { id: 'v1', kitsuId: 'v1', title: 'Saved title', score: 8 };
  const state = boundary({ list: [saved] });
  const open = handler('openEntry', state.bindings);
  open({ id: 'v1', title: 'Override' });
  assert.equal(state.state.setSelectedAnimeData, saved);
  assert.equal(state.state.setSelectedOwnerId, 'friend');
  open({ id: 'v2', image: 'cover', title: 'Fallback' });
  assert.equal(state.state.setSelectedAnimeData.imageUrl, 'cover');
  assert.equal(state.state.setSelectedAnimeData.mediaType, 'vn');
  handler('openLibrary', state.bindings)('vn', 'watching');
  assert.equal(state.state.setTab, 'library');
  assert.equal(state.state.setStatus, 'watching');
  assert.equal(state.state.setMediaFilter, 'vn');
});

test('follow transaction preserves other concurrent follows and removes legacy string records', async () => {
  let value = [{ uid: 'other' }, 'friend'];
  const state = boundary({
    isFriend: true,
    runTransaction: async (_db, callback) => {
      value.push({ uid: 'concurrent' });
      return callback({ get: async () => snapshot({ friends: value }), update: (_ref, changes) => { value = changes.friends; } });
    },
  });
  await handler('handleFriendAction', state.bindings)();
  assert.deepEqual(value, [{ uid: 'other' }, { uid: 'concurrent' }]);
  assert.equal(state.state.setIsFriend, false);
});

test('saved provider IDs and Hall of Fame fallbacks keep the unified hydration routing', () => {
  for (const [entry, id] of [
    [{ id: '123', title: 'Kitsu saved' }, '123'],
    [{ id: '123', provider: 'anilist', title: 'AniList saved' }, 'anilist:123'],
    [{ id: '123', mediaType: 'vn', title: 'VN saved' }, 'v123'],
    [{ vnId: 42, id: 'document', title: 'VN legacy' }, 'v42'],
    [{ kitsuId: 'anilist:123', title: 'Namespaced' }, 'anilist:123'],
    [{ attributes: { id: '123', canonicalTitle: 'Kitsu attributes' } }, '123'],
  ]) {
    const normalized = profileEntry(entry);
    assert.equal(normalized.kitsuId, id);
    assert.ok(normalized.canonicalTitle);
    assert.equal(normalized.mediaType === 'vn', id.startsWith('v'));
    const state = boundary({ list: [normalized] });
    handler('openEntry', state.bindings)(entry);
    assert.equal(state.state.setSelectedAnimeData, normalized);
    assert.equal(state.state.setSelectedOwnerId, 'friend');
  }
});

test('actual modal hydration accepts immediate saved data for all three providers', async () => {
  const modal = pages.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AnimeDetailsModal');
  const hydrationEffect = modal.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(pages) === 'useEffect' && node.expression.arguments[0].getText(pages).includes('fetchMediaDetails(publicId)'));
  assert.ok(hydrationEffect, 'modal must hydrate immediate entries independently');
  for (const entry of [{ id: '123', title: 'Kitsu' }, { id: '123', provider: 'anilist', title: 'AniList' }, { id: '123', mediaType: 'vn', title: 'VN' }]) {
    const saved = profileEntry(entry);
    let receivedId;
    let hydrated;
    const metadata = { attributes: { synopsis: 'Hydrated public metadata' } };
    evaluate(hydrationEffect.expression.arguments[0], {
      kitsuId: saved.kitsuId,
      isAniList: saved.provider === 'anilist', isVn: saved.mediaType === 'vn',
      setHydratedMedia: value => { hydrated = value; }, setDetailsError() {},
      fetchMediaDetails: async id => { receivedId = id; return metadata; },
    })();
    await flush();
    assert.equal(receivedId, saved.kitsuId);
    assert.equal(hydrated, metadata);
    assert.equal(saved.title, entry.title);
  }
});

test('viewer changes hide stale profile data before another privacy lookup resolves', () => {
  const guard = component.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(pages).includes('loadedTarget?.targetUid'));
  assert.ok(guard);
  const hidden = bindings => evaluate(guard.expression, bindings);
  const current = { targetUid: 'friend', currentUserId: 'owner', readOnly: false, visitorPreview: false };
  assert.equal(hidden({ ...current, loadedTarget: current }), false);
  assert.equal(hidden({ ...current, currentUserId: 'guest', loadedTarget: current }), true);
  assert.equal(hidden({ ...current, readOnly: true, loadedTarget: current }), true);
  assert.equal(hidden({ ...current, targetUid: 'next', loadedTarget: current }), true);
  assert.equal(hidden({ ...current, visitorPreview: true, loadedTarget: current }), true);
});
test('visitor preview never loads owner-only library documents, even for its owner', async () => {
  const preview = boundary({ targetUid: 'me', visitorPreview: true, visitor: true });
  evaluate(effects[0].expression.arguments[0], preview.bindings)(); await flush();
  assert.ok(preview.reads.some(path => path.endsWith('/me/publicLibrary')));
  assert.equal(preview.reads.some(path => path.endsWith('/animeList')), false);
  const hidden = boundary({ targetUid: 'me', visitorPreview: true, visitor: true, getDoc: async () => snapshot({ libraryPublic: false }) });
  evaluate(effects[0].expression.arguments[0], hidden.bindings)(); await flush();
  assert.equal(hidden.state.setLibraryPrivate, true);
  assert.equal(hidden.reads.some(path => path.endsWith('/publicLibrary') || path.endsWith('/animeList')), false);
});
