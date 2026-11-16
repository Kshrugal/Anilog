import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const cacheSource = await readFile(new URL('../services/media-cache.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(cacheSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createMediaCache, mediaDetailsCache } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

let time = 0;
let calls = 0;
const cache = createMediaCache({ now: () => time });
const slow = deferred();
const load = () => { calls++; return slow.promise; };
const first = cache.get('v1', load);
const second = cache.get('v1', load);
assert.equal(first, second, 'simultaneous reads share a request');
await Promise.resolve();
assert.equal(calls, 1);
time = 500;
slow.resolve({ id: 'v1' });
await first;
time = 300_499;
assert.deepEqual(await cache.get('v1', load), { id: 'v1' });
assert.equal(calls, 1, 'cache hit does not refetch');
time = 300_500;
await cache.get('v1', async () => { calls++; return { id: 'v1', refreshed: true }; });
assert.equal(calls, 2, 'TTL starts on completion and expires at five minutes');

const failed = deferred();
const errors = [cache.get('error', () => failed.promise), cache.get('error', () => failed.promise)];
failed.reject(new Error('offline'));
assert.ok((await Promise.allSettled(errors)).every(result => result.status === 'rejected'));
assert.equal(await cache.get('error', async () => 'retry'), 'retry', 'failed requests are cleared');
await assert.rejects(cache.get('throw', () => { throw new Error('sync'); }));
assert.equal(await cache.get('throw', async () => 'retry'), 'retry');

const bounded = createMediaCache();
let boundedCalls = 0;
const read = key => bounded.get(key, async () => { boundedCalls++; return key; });
for (let i = 0; i < 100; i++) await read(String(i));
await read('0');
await read('100');
await read('0');
assert.equal(boundedCalls, 101, 'recently used entry survives eviction');
await read('1');
assert.equal(boundedCalls, 102, 'default capacity evicts the least recently used of 100 entries');
assert.throws(() => createMediaCache({ maxEntries: 0 }), RangeError);

const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const loader = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(tree) === 'fetchMediaDetails');
const requests = [];
const context = vm.createContext({
  mediaDetailsCache, structuredClone, AbortSignal, KITSU_API_URL: 'https://kitsu.io/api/edge',
  getAniListMedia: async id => { requests.push(id); return { id, attributes: { canonicalTitle: 'Anime' } }; },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => url.includes('vndb')
      ? { results: [{ id: 'v17', title: 'Test VN', length_minutes: 1800, rating: 88.5 }] }
      : { data: { id: '17', attributes: { canonicalTitle: 'Kitsu anime' } } } };
  },
});
vm.runInContext(ts.transpileModule(`const ${loader.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const fetchDetails = id => context.fetchDetails(id);
vm.runInContext('globalThis.fetchDetails = fetchMediaDetails', context);
const [vn, duplicate] = await Promise.all([fetchDetails('v17'), fetchDetails('v17')]);
assert.equal(requests.length, 1);
assert.notEqual(vn, duplicate, 'callers receive independent metadata objects');
vn.attributes.canonicalTitle = 'Edited locally';
assert.equal((await fetchDetails('v17')).attributes.canonicalTitle, 'Test VN');
assert.equal(duplicate.attributes.episodeCount, 0);
assert.equal(duplicate.attributes.estimatedLengthMinutes, 1800);
assert.equal(duplicate.attributes.averageRating, '88.5');
assert.match(JSON.parse(requests[0].options.body).fields, /length_minutes/);
await Promise.all([fetchDetails(17), fetchDetails('17'), fetchDetails('anilist:17'), fetchDetails('anilist:17')]);
assert.equal(requests.length, 3, 'provider identities remain separate; numeric/string IDs deduplicate');

const component = name => tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
const transpile = node => ts.transpileModule(node.getText(tree).replace(/^export /, ''), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const profile = deferred();
let cleanup, subscriptions = 0, unsubscribed = 0;
const notifications = vm.createContext({
  React: { createElement: () => null }, motion: { aside: 'aside' }, BellIcon: 'bell',
  useState: initial => [initial, () => {}], useEffect: effect => { cleanup = effect(); },
  getDoc: () => profile.promise, doc: () => ({}), appId: 'test',
  onSnapshot: () => { subscriptions++; return () => { unsubscribed++; }; },
  query: () => ({}), collection: () => ({}), orderBy: () => ({}), limit: () => ({}),
  createPortal: value => value, document: { body: {} },
});
vm.runInContext(transpile(component('NotificationCenter')), notifications);
vm.runInContext('NotificationCenter({db: {}, userId: "test"})', notifications);
cleanup();
profile.resolve({ data: () => ({ friends: [] }) });
await new Promise(resolve => setImmediate(resolve));
assert.equal(subscriptions, 0, 'closing before profile resolution never attaches a listener');
vm.runInContext('NotificationCenter({db: {}, userId: "test"})', notifications);
await new Promise(resolve => setImmediate(resolve));
assert.equal(subscriptions, 1);
cleanup();
assert.equal(unsubscribed, 1, 'mounted listener is unsubscribed');

let opened = 0, incremented = 0;
let nextFrame = 0;
const frames = new Map();
const cardCleanups = [];
const cards = vm.createContext({
  React: { createElement: (type, props, ...children) => ({ type, props, children }) },
  motion: { div: 'div' }, ThemeContext: {}, useContext: () => ({ theme: {} }),
  useMotionValue: () => ({ set() {} }), useTransform: () => 0, useMotionTemplate: () => '',
  useRef: () => ({ current: null }), useEffect: effect => cardCleanups.push(effect()), useMemo: fn => fn(),
  window: { matchMedia: query => ({ matches: !query.includes('reduced-motion') }) },
  requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame: id => frames.delete(id),
  PlusIcon: 'plus', HeartIcon: 'heart', StarIcon: 'star',
  open: () => { opened++; }, increment: () => { incremented++; },
});
vm.runInContext(transpile(component('AnimeCard')), cards);
for (const viewMode of ['grid', 'list']) {
  for (const mediaType of ['anime', 'vn']) {
    cards.viewMode = viewMode;
    cards.mediaType = mediaType;
    const card = vm.runInContext('AnimeCard({anime: {title: "Test", mediaType}, viewMode, onCardClick: open, onQuickIncrement: increment})', cards);
    assert.equal(card.props.layout, 'position');
    assert.equal(card.props.tabIndex, 0);
    for (const key of ['Enter', ' ']) {
      let prevented = false;
      card.props.onKeyDown({ key, target: card, currentTarget: card, preventDefault() { prevented = true; } });
      assert.ok(prevented);
    }
    card.props.onKeyDown({ key: 'Enter', target: {}, currentTarget: card });
    const walk = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(walk)];
    const button = walk(card).find(node => node.type === 'button');
    assert.match(button.props['aria-label'], mediaType === 'vn' ? /5% reading/ : /1 episode/);
    assert.match(viewMode === 'list' ? button.props.className : walk(card).find(node => node.children?.includes(button))?.props.className, /opacity-100/);
    button.props.onClick({ stopPropagation() {} });
  }
}
assert.equal(opened, 8, 'Enter/Space open cards, nested controls do not');
assert.equal(incremented, 4);
const tilted = vm.runInContext('AnimeCard({anime: {title: "Tilt"}, onCardClick: open})', cards);
let measurements = 0;
const pointer = { clientX: 10, clientY: 20, currentTarget: { getBoundingClientRect() { measurements++; return { width: 100, height: 150, left: 0, top: 0 }; } } };
tilted.props.onMouseMove(pointer);
tilted.props.onMouseMove(pointer);
assert.equal(frames.size, 1, 'pointer events are coalesced into one frame');
assert.equal(measurements, 0, 'pointer events do not synchronously measure layout');
tilted.props.onMouseLeave();
assert.equal(frames.size, 0, 'leaving cancels pending tilt');
tilted.props.onMouseMove(pointer);
for (const cleanup of cardCleanups) cleanup?.();
assert.equal(frames.size, 0, 'unmount cancels pending tilt');
console.log('Media cache, loader, tile keyboard controls, and notification cleanup tests passed (mocked, no data writes).');
