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
const compileService = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const loadService = async name => import(`data:text/javascript;base64,${Buffer.from(compileService(await readFile(new URL(`../services/${name}.ts`, import.meta.url), 'utf8'))).toString('base64')}`);
const { readVnJournal, vnJournalFields, newVnRun, vnDateValid } = await loadService('vn-journal');
const { publicLibraryEntry } = await loadService('profile-identity');
const franchiseUrl = `data:text/javascript;base64,${Buffer.from(compileService(await readFile(new URL('../services/franchises.ts', import.meta.url), 'utf8'))).toString('base64')}`;
const analyticsSource = compileService(await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8')).replace(/from ['"]\.\/franchises['"]/, `from '${franchiseUrl}'`);
const { runtimeFor, exactTime } = await import(`data:text/javascript;base64,${Buffer.from(analyticsSource).toString('base64')}`);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness({ failSave = false, missingId = false, mediaPromise, animeOverride, account, latest } = {}) {
  const pendingRead = deferred();
  const states = [];
  const dependencies = [];
  const effects = [];
  const writes = [];
  let cursor = 0;
  let tree;
  const props = {
    anime: animeOverride || { ...(missingId ? {} : { id: 'v123' }), title: 'A visual novel', mediaType: 'vn', genres: [] },
    db: {}, userId: 'test-owner', ownerId: 'test-owner', username: 'Tester', hideFollowing: account === 'visitor-preview', onClose() {},
  };
  const sandbox = {
    React: { createElement: (type, attributes, ...children) => ({ type, props: attributes || {}, children }) },
    motion: { div: 'div', button: 'button' },
    CloseIcon: 'CloseIcon', StarIcon: 'StarIcon', HeartIcon: 'HeartIcon', ClockIcon: 'ClockIcon', MinusIcon: 'MinusIcon', PlusIcon: 'PlusIcon', ChevronDownIcon: 'ChevronDownIcon', runtimeFor, exactTime,
    ThemeContext: {}, useContext: () => ({ theme: { progressbar: 'bg-blue-500', button: 'bg-blue-500' } }),
    useCallback: callback => callback,
    mediaFollowingId: anime => anime.id || '', MediaFollowing: 'MediaFollowing',
    readVnJournal, vnJournalFields, VnJournal: 'VnJournal',
    vnSynopsis: text => text, VN_PLATFORMS: {}, VN_LANGUAGES: {},
    auth: { currentUser: account ? { uid: 'test-owner', isAnonymous: account === 'anonymous' } : null },
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
    runTransaction: async (_db, update) => {
      if (failSave) throw new Error('Offline');
      return update({ get: () => latest || pendingRead.promise, set: (ref, data) => writes.push({ ref, data }) });
    },
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

assert.equal(harness({ account: 'member' }).nodes().find(node => node.type === 'MediaFollowing')?.props.mediaId, 'v123');
for (const account of [undefined, 'anonymous', 'visitor-preview']) {
  assert.ok(!harness({ account }).nodes().some(node => node.type === 'MediaFollowing'));
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

const legacyVn = { ...saved, vnPlaytimeHours: 12.5, vnEndingsCompleted: 3, vnRoute: 'Private route', platform: 'Switch', status: 'completed' };
const vnEditor = harness();
vnEditor.pendingRead.resolve({ exists: () => true, data: () => legacyVn });
await vnEditor.flush();
const journalCard = vnEditor.nodes().find(node => node.type === 'VnJournal');
const journal = journalCard.props.journal;
assert.equal(journal.runs[0].routes[0].name, legacyVn.vnRoute);
assert.equal(journal.runs[0].platform, 'Switch');
assert.equal(journal.runs[0].milestone, 'main', 'legacy completion does not assume 100% clear');
assert.equal(journal.baselineMinutes, 750);
assert.equal(journal.baselineEndings, 3);
assert.equal(vnDateValid('2024-02-29'), true);
assert.equal(vnDateValid('2026-02-29'), false);
const replay = { ...newVnRun('replay-1', 'Replay'), bookmark: 'Spoiler checkpoint', milestone: 'full', endings: [{ id: 'ending-1', name: 'Secret ending', unlocked: true }],
  sessions: [{ id: 'session-1', date: '2026-11-20', minutes: 90, routeId: '' }] };
journalCard.props.onChange({ ...journal, activeId: replay.id, runs: [...journal.runs, replay] });
vnEditor.render();
await vnEditor.saveButton().props.onClick();
const storedVn = vnEditor.writes[0].data;
assert.equal(storedVn.vnPlaytimeHours, 14);
assert.equal(storedVn.vnEndingsCompleted, 4);
assert.equal(storedVn.vnJournal.revision, 1);
assert.equal(vnJournalFields(readVnJournal(storedVn)).vnPlaytimeHours, 14, 'reopening never double-counts sessions');
assert.equal(readVnJournal(storedVn).runs[0].milestone, 'main');
assert.equal(readVnJournal(storedVn).runs[1].milestone, 'full');
const projection = publicLibraryEntry(storedVn);
assert.equal(projection.vnPlaytimeHours, 14);
assert.ok(!('vnJournal' in projection) && !('vnRoute' in projection) && !('vnEndingsCompleted' in projection) && !('platform' in projection));
const staleVn = harness({ latest: { exists: () => true, data: () => storedVn } });
staleVn.pendingRead.resolve({ exists: () => true, data: () => legacyVn });
await staleVn.flush();
await staleVn.saveButton().props.onClick();
staleVn.render();
assert.equal(staleVn.writes.length, 0, 'an older tab cannot overwrite saved sessions');
assert.ok(staleVn.nodes().some(node => node.props.role === 'alert'));

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
