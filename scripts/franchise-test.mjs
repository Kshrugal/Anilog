import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../services/franchises.ts', import.meta.url), 'utf8');
const compile = (s, module = ts.ModuleKind.ESNext) => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022, module } }).outputText;
const helpers = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`);
const { resolveMemberships, mediaKey, familyFor } = helpers;
const entry = (id, title, mediaType = 'anime') => ({ kitsuId: id, title, mediaType });
const library = [entry('anilist:20', 'Naruto'), entry('anilist:1735', 'Naruto: Shippuden'), entry('anilist:269', 'Bleach'), entry('anilist:116674', 'BLEACH: Thousand-Year Blood War'), entry('anilist:8247', 'Bleach the Movie: Hell Verse'), entry('anilist:30012', 'BLEACH', 'manga'), entry('v11', 'Fate/stay night', 'vn'), entry('v7', 'Tsukihime', 'vn'), entry('anilist:3784', 'the Garden of sinners Chapter 1: Thanatos.'), entry('v777', 'Mahoutsukai no Yoru', 'vn'), entry('anilist:10087', 'Fate/Zero')];

test('cross-format Naruto, Bleach and TYPE-MOON identities work even offline', () => {
  const before = JSON.stringify(library), result = resolveMemberships(library);
  assert.equal(result['anilist:20'].franchiseKey, result['anilist:1735'].franchiseKey);
  for (const id of ['anilist:269', 'anilist:116674', 'anilist:8247', 'anilist:30012']) assert.equal(result[id].franchise, 'Bleach');
  for (const id of ['v11', 'v7', 'anilist:3784', 'v777', 'anilist:10087']) assert.equal(result[id].universe, 'TYPE-MOON');
  assert.notEqual(result.v11.franchiseKey, result.v7.franchiseKey);
  assert.equal(JSON.stringify(library), before);
  assert.equal(result.v11.confidence, 'reviewed');
});
test('unfamiliar titles connect through source/adaptation and intermediate catalogue nodes', () => {
  const entries = [entry('anilist:1', 'Another English Title'), entry('anilist:3', 'A Completely Different Subtitle', 'manga')];
  const catalogue = {
    'anilist:1': { key: 'anilist:1', title: 'Another English Title', relations: [{ key: 'anilist:2', type: 'SOURCE' }] },
    'anilist:2': { key: 'anilist:2', title: 'Original Story', year: 1999, relations: [{ key: 'anilist:3', type: 'SEQUEL' }] },
    'anilist:3': { key: 'anilist:3', title: 'A Completely Different Subtitle', year: 2004 },
  };
  const result = resolveMemberships(entries, catalogue);
  assert.equal(result['anilist:1'].franchiseKey, result['anilist:3'].franchiseKey);
  assert.equal(result['anilist:1'].franchise, 'Original Story');
  assert.equal(result['anilist:1'].confidence, 'catalogue');
  assert.equal(Object.keys(result).length, 2, 'untracked catalogue nodes are never library memberships');
});
test('same studio, creator, cameo, OTHER, unofficial relations and crossover names cannot silently merge', () => {
  const entries = [entry('anilist:1', 'Unrelated Story A'), entry('anilist:2', 'Unrelated Story B')];
  for (const type of ['CHARACTER', 'OTHER', 'CONTAINS']) {
    const creators = [{ name: 'Same Author', role: 'Original Creator' }];
    const result = resolveMemberships(entries, { 'anilist:1': { key: 'anilist:1', title: entries[0].title, creators, relations: [{ key: 'anilist:2', type }] }, 'anilist:2': { key: 'anilist:2', title: entries[1].title, creators } });
    assert.notEqual(result['anilist:1'].universeKey, result['anilist:2'].universeKey);
  }
  assert.equal(familyFor(['Naruto × Ninku']), null);
  assert.equal(familyFor(['Ore Monogatari!!']), null);
  assert.equal(familyFor(['Fateful Encounter']), null);
  const fan = resolveMemberships([entry('v7', 'Tsukihime', 'vn'), entry('v999', 'Tsukihime Fan Game', 'vn')], { v7: { key: 'v7', title: 'Tsukihime' }, v999: { key: 'v999', title: 'Tsukihime Fan Game', relations: [{ key: 'v7', type: 'side', official: false }] } });
  assert.notEqual(fan.v7.universeKey, fan.v999.universeKey);
});
test('an unlabelled hub cannot transitively merge two distinct reviewed franchises', () => {
  const entries = [entry('anilist:20', 'Naruto'), entry('anilist:269', 'Bleach')];
  const result = resolveMemberships(entries, {
    'anilist:20': { key: 'anilist:20', title: 'Naruto' },
    'anilist:269': { key: 'anilist:269', title: 'Bleach' },
    'anilist:99999': { key: 'anilist:99999', title: 'Ambiguous crossover hub', relations: [{ key: 'anilist:20', type: 'SPIN_OFF' }, { key: 'anilist:269', type: 'SPIN_OFF' }] },
  });
  assert.notEqual(result['anilist:20'].franchiseKey, result['anilist:269'].franchiseKey);
  assert.notEqual(result['anilist:20'].universeKey, result['anilist:269'].universeKey);
});
test('official VN setting links join universes without collapsing individual series', () => {
  const entries = [entry('v1', 'Unknown VN One', 'vn'), entry('v2', 'Unknown VN Two', 'vn')];
  const result = resolveMemberships(entries, { v1: { key: 'v1', title: entries[0].title, relations: [{ key: 'v2', type: 'set', official: true }] }, v2: { key: 'v2', title: entries[1].title } });
  assert.equal(result.v1.universeKey, result.v2.universeKey);
  assert.notEqual(result.v1.franchiseKey, result.v2.franchiseKey);
});
test('exact TYPE-MOON developer establishes umbrella, not a shared-staff franchise', () => {
  const result = resolveMemberships([entry('v1', 'Untranslated Title', 'vn')], { v1: { key: 'v1', title: 'Untranslated Title', developers: [{ id: 'p6', name: 'TYPE-MOON' }], creators: [{ name: 'Nasu Kinoko', role: 'scenario' }] } });
  assert.equal(result.v1.universe, 'TYPE-MOON'); assert.equal(result.v1.franchise, 'Untranslated Title');
  assert.match(result.v1.basis, /developer/); assert.deepEqual(result.v1.creators, ['Nasu Kinoko']);
  assert.equal(mediaKey({ id: 20, provider: 'anilist' }), 'anilist:20');
  assert.equal(mediaKey({ id: '1' }), 'kitsu:1');
});
test('Unicode aliases and relation input order are stable', () => {
  const entries = [entry('v1', '月姫', 'vn'), entry('1', '空の境界 第一章'), entry('2', 'NARUTO -ナルト- 疾風伝')];
  const a = resolveMemberships(entries), b = resolveMemberships([...entries].reverse());
  assert.equal(a.v1.universe, 'TYPE-MOON'); assert.equal(a['1'].universe, 'TYPE-MOON'); assert.equal(a['2'].franchise, 'Naruto');
  for (const e of entries) assert.equal(a[e.kitsuId].universeKey, b[e.kitsuId].universeKey);
});
test('unregistered VN adaptations bridge providers only when exact aliases and original credits agree', () => {
  const entries = [entry('anilist:500', 'An English Adaptation Title'), entry('v500', 'Original Work Title', 'vn')];
  const catalogue = {
    'anilist:500': { key: 'anilist:500', title: entries[0].title, titles: ['Original Work Title'], fetchedAt: 1, creators: [{ name: 'Creator Studio', role: 'Original Creator' }] },
    v500: { key: 'v500', title: entries[1].title, fetchedAt: 1, developers: [{ id: 'p500', name: 'Creator Studio' }] },
  };
  const result = resolveMemberships(entries, catalogue);
  assert.equal(result['anilist:500'].franchiseKey, result.v500.franchiseKey);
  assert.match(result.v500.basis, /exact alias and original credit/);
  catalogue.v500.developers = [{ id: 'p501', name: 'Unrelated Developer' }];
  const separate = resolveMemberships(entries, catalogue);
  assert.notEqual(separate['anilist:500'].franchiseKey, separate.v500.franchiseKey);
});
test('large relation graphs stay bounded and never add context nodes to the user library', () => {
  const catalogue = Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`anilist:${i + 10000}`, { key: `anilist:${i + 10000}`, title: i % 4 ? `Unfamiliar Chronicle ${i}` : `Fate/EXTRA Side ${i}`, titles: [`Japanese alias ${i}`, `English alias ${i}`], relations: [{ key: `anilist:${10000 + ((i + 1) % 1200)}`, type: 'SEQUEL' }] }]));
  const entries = Object.values(catalogue).slice(0, 200).map(node => entry(node.key, node.title));
  const started = performance.now();
  const result = resolveMemberships(entries, catalogue);
  assert.equal(Object.keys(result).length, 200);
  assert.ok(performance.now() - started < 2000, 'avoid repeated alias normalization across graph edges');
});

const loaderSource = await readFile(new URL('../services/franchise-catalogue.ts', import.meta.url), 'utf8');
function loader(fetch, storage = new Map()) {
  const exports = {}, calls = [];
  const context = { exports, require: () => helpers, AbortController, console, Date,
    fetch: async (url, options) => { calls.push({ url, body: options.body ? JSON.parse(options.body) : null }); return fetch(url, options); },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: (callback, ms) => { if (ms < 15000) queueMicrotask(callback); return 1; }, clearTimeout() {},
  };
  vm.runInNewContext(compile(loaderSource, ts.ModuleKind.CommonJS), context);
  return { ...exports, calls, storage };
}
const response = data => ({ ok: true, json: async () => data });
const media = id => ({ id, idMal: id, type: 'ANIME', format: 'TV', duration: 23, episodes: 220, status: 'FINISHED', title: { english: id === 20 ? 'Naruto' : 'Naruto Shippuden' }, relations: { edges: [] }, staff: { edges: [] } });
test('loader batches public IDs, deduplicates inflight scans and reuses persistent metadata', async () => {
  const scan = loader(async () => response({ data: { Page: { media: [media(20), media(1735)] } } }));
  const entries = library.slice(0, 2);
  const [a, b] = await Promise.all([scan.loadFranchiseCatalogue(entries), scan.loadFranchiseCatalogue(entries)]);
  assert.equal(scan.calls.length, 1); assert.equal(a['anilist:20'].title, b['anilist:20'].title);
  assert.equal(a['anilist:20'].durationMinutes, 23);
  assert.equal(a['anilist:20'].episodeCount, 220);
  assert.equal(a['anilist:20'].runtimeSource, 'AniList');
  assert.ok(scan.calls[0].body.query.includes('relationType(version: 3)'));
  assert.deepEqual(scan.calls[0].body.variables.ids, [1735, 20]);
  const restored = loader(async () => { throw new Error('Should be cached'); }, scan.storage);
  await restored.loadFranchiseCatalogue(entries);
  assert.equal(restored.calls.length, 0);
  assert.doesNotMatch([...scan.storage.values()].join(''), /userId|email|watchedEpisodes/);
});
test('exact Kitsu mapping resolves identity without fuzzy search and remains cached', async () => {
  const scan = loader(async url => url.includes('kitsu.io') ? response({ data: [{ attributes: { externalSite: 'anilist/anime', externalId: '20' } }] }) : response({ data: { Page: { media: [media(20)] } } }));
  const result = await scan.loadFranchiseCatalogue([entry('1', 'Naruto')]);
  assert.ok(result['anilist:20'].aliases.includes('kitsu:1'));
  await scan.loadFranchiseCatalogue([entry('1', 'Naruto')]);
  assert.equal(scan.calls.length, 2);
  assert.doesNotMatch(scan.calls[1].body.query, /\bsearch\s*:/);
});
test('HTTP/rate-limit failures release dedup jobs and are retryable', async () => {
  let fail = true;
  const scan = loader(async () => fail ? { ok: false, status: 429 } : response({ data: { Page: { media: [media(20)] } } }));
  await assert.rejects(scan.loadFranchiseCatalogue([library[0]]), /rate limit/);
  fail = false;
  const result = await scan.loadFranchiseCatalogue([library[0]]);
  assert.equal(result['anilist:20'].title, 'Naruto');
});
test('Kitsu supplies an exact runtime when the mapped catalogue lacks one', async () => {
  const scan = loader(async url => url.includes('/mappings')
    ? response({ data: [{ attributes: { externalSite: 'anilist/anime', externalId: '20' } }] })
    : url.includes('kitsu.io') ? response({ data: { attributes: { canonicalTitle: 'Naruto', episodeLength: 23, episodeCount: 220, showType: 'TV', status: 'finished' } } })
    : response({ data: { Page: { media: [{ ...media(20), duration: null }] } } }));
  const result = await scan.loadFranchiseCatalogue([entry('1', 'Naruto')]);
  assert.equal(result['anilist:20'].durationMinutes, 23);
  assert.equal(result['anilist:20'].runtimeSource, 'Kitsu');
  assert.equal(result['anilist:20'].runtimeSourceUrl, 'https://kitsu.app/anime/1');
  assert.ok(result['anilist:20'].aliases.includes('kitsu:1'));
  assert.equal(scan.calls.length, 3);
});
