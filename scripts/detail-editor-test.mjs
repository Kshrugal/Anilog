import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component with deterministic hooks and an in-memory database.
// No Firebase account or production data is used by these tests.
const source = await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('Pages.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AnimeDetailsModal');
assert.ok(component, 'detail editor must exist');
const compiled = ts.transpileModule(component.getText(parsed), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness({ failSave = false, missingId = false, mediaPromise, animeOverride } = {}) {
  const pendingRead = deferred();
  const states = [];
  const dependencies = [];
  const effects = [];
  const writes = [];
  let cursor = 0;
  let tree;
  const props = {
    anime: animeOverride || { ...(missingId ? {} : { id: 'v123' }), title: 'A visual novel', mediaType: 'vn', genres: [] },
    db: {}, userId: 'test-owner', ownerId: 'test-owner', username: 'Tester', onClose() {},
  };
  const sandbox = {
    React: { createElement: (type, attributes, ...children) => ({ type, props: attributes || {}, children }) },
    motion: { div: 'div', button: 'button' },
    CloseIcon: 'CloseIcon', StarIcon: 'StarIcon', HeartIcon: 'HeartIcon',
    ThemeContext: {}, useContext: () => ({ theme: { progressbar: 'bg-blue-500', button: 'bg-blue-500' } }),
    useRef: initial => { const index = cursor++; if (!(index in states)) states[index] = { current: initial }; return states[index]; },
    fetchMediaDetails: () => mediaPromise || Promise.resolve({ attributes: {} }),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
        dependencies[index] = deps;
        effects.push(callback);
      }
    },
    createPortal: value => value,
    document: { body: { style: {} }, addEventListener() {}, removeEventListener() {} },
    doc: (_db, path, id) => ({ path, id }),
    getDocFromServer: () => pendingRead.promise,
    setDoc: async (ref, data) => { if (failSave) throw new Error('Offline'); writes.push({ ref, data }); },
    logActivity: async () => {}, appId: 'test-app',
    console: { error() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(compiled, sandbox);
  const render = () => {
    cursor = 0;
    tree = sandbox.AnimeDetailsModal(props);
    for (const effect of effects.splice(0)) effect();
    return tree;
  };
  const walk = value => {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) return value.flatMap(walk);
    return [value, ...(value.children || []).flatMap(walk)];
  };
  const nodes = () => walk(tree);
  const saveButton = () => nodes().find(node => node.type === 'button' && node.children.includes('Update Log'));
  const rateButton = rating => nodes().find(node => node.props['aria-label'] === `Rate ${rating} out of 10`);
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  render();
  return { pendingRead, writes, render, nodes, saveButton, rateButton, flush };
}

const saved = { status: 'watching', watchedEpisodes: 35, score: 8.5, notes: 'Keep this note', favorite: true };
const editor = harness();
assert.equal(editor.saveButton().props.disabled, true, 'saving is disabled before the library read completes');
await editor.saveButton().props.onClick();
assert.equal(editor.writes.length, 0, 'even direct handler invocation cannot overwrite an unread log');
editor.pendingRead.resolve({ exists: () => true, data: () => saved });
await editor.flush();
assert.equal(editor.saveButton().props.disabled, false);
editor.rateButton(3).props.onMouseEnter();
editor.render();
assert.equal(editor.rateButton(8).props['aria-pressed'], false, 'decimal score is not silently rounded');
await editor.saveButton().props.onClick();
assert.equal(editor.writes[0].data.score, 8.5, 'hovering must not change the saved score');
assert.equal(editor.writes[0].data.watchedEpisodes, 35);
assert.equal(editor.writes[0].data.notes, 'Keep this note');
assert.equal(editor.writes[0].data.favorite, true);

const failure = harness();
failure.pendingRead.reject(new Error('Permission denied'));
await failure.flush();
assert.equal(failure.saveButton().props.disabled, true, 'read failures cannot unlock saving');
assert.ok(failure.nodes().some(node => node.props.role === 'alert'));
await failure.saveButton().props.onClick();
assert.equal(failure.writes.length, 0);

const invalid = harness({ missingId: true });
await invalid.saveButton().props.onClick();
assert.equal(invalid.writes.length, 0, 'missing identity cannot write the undefined document');

const offline = harness({ failSave: true });
offline.pendingRead.resolve({ exists: () => false });
await offline.flush();
await offline.saveButton().props.onClick();
offline.render();
assert.ok(offline.nodes().some(node => node.props.role === 'alert'), 'save failure is visible to the user');

console.log('Detail editor behavioral tests passed.');

const metadata = deferred();
const hydrated = harness({ animeOverride: { kitsuId: 'anilist:1', title: 'Saved title', totalEpisodes: 12 }, mediaPromise: metadata.promise });
hydrated.pendingRead.resolve({ exists: () => true, data: () => ({ status: 'watching', watchedEpisodes: 20, score: 8.5 }) });
await hydrated.flush();
metadata.resolve({ attributes: { canonicalTitle: 'Provider title', episodeCount: 24, episodeLength: 22, posterImage: { original: 'https://example.test/poster.jpg' }, genres: ['Drama'] } });
await hydrated.flush();
await hydrated.saveButton().props.onClick();
assert.equal(hydrated.writes[0].data.watchedEpisodes, 20, 'fresh provider total prevents clamping to stale saved total');
assert.equal(hydrated.writes[0].data.totalEpisodes, 24);
assert.equal(hydrated.writes[0].data.imageUrl, 'https://example.test/poster.jpg');
assert.deepEqual([...hydrated.writes[0].data.genres], ['Drama']);
assert.equal(hydrated.writes[0].data.durationMinutes, 22);
console.log('Deferred public metadata hydration tests passed.');

const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const appTree = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const loader = appTree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(appTree) === 'fetchMediaDetails');
assert.ok(loader);
let requestedFields;
const mediaContext = vm.createContext({
  AbortSignal,
  structuredClone,
  mediaDetailsCache: { get: (_key, load) => load() },
  fetch: async (_url, options) => {
    requestedFields = JSON.parse(options.body).fields;
    return { ok: true, json: async () => ({ results: [{ id: 'v17', title: 'Test VN', length: 5, length_minutes: 1800, rating: 88.5 }] }) };
  },
});
vm.runInContext(ts.transpileModule(`const ${loader.getText(appTree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, mediaContext);
const vn = await vm.runInContext('fetchMediaDetails("v17")', mediaContext);
assert.equal(vn.attributes.episodeCount, 0, 'VN length categories are not episode counts or hours');
assert.equal(vn.attributes.estimatedLengthMinutes, 1800);
assert.equal(vn.attributes.averageRating, '88.5', 'VNDB ratings retain their 100-point scale');
assert.match(requestedFields, /length_minutes/);
console.log('Visual novel metadata tests passed.');
