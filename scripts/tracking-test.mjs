import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const trackingSource = await readFile(new URL('../services/tracking.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(trackingSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { nextProgress, scoreSummary, planImport, importPayload, resetBackup } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const profileSource = await readFile(new URL('../services/profile.ts', import.meta.url), 'utf8');
const profile = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(profileSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
const pages = ts.createSourceFile('Pages.tsx', await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Execute the real handler bodies with a small in-memory Firestore boundary.
function handler(component, name, bindings) {
  bindings = { useCallback: callback => callback, pendingProgressRef: { current: new Set() }, setPendingProgress() {}, profileIsVn: profile.profileIsVn, ...bindings };
  const fn = pages.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === component);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(pages) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(fn);
  assert.ok(initializer, `${component}.${name} exists`);
  const js = ts.transpileModule(`const handler = ${initializer.getText(pages)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${js}\nreturn handler;`)(...Object.values(bindings));
}

const normalize = title => title.toLowerCase().replace(/[^a-z0-9]/g, '');
const quiet = () => {};
const snapshot = (value, id = 'entry') => ({ id, ref: id, exists: () => value !== undefined, data: () => value });
const querySnapshot = entries => ({ docs: entries.map(([id, value]) => snapshot(value, id)), size: entries.length });

test('progress caps, completes once, keeps dates, and handles unknown episode totals', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const next = nextProgress({ watchedEpisodes: 11, totalEpisodes: 12 }, now);
  assert.equal(next.progress, 12);
  assert.equal(next.changes.status, 'completed');
  assert.equal(next.changes.completedAt, '2026-11-16');
  assert.equal(nextProgress({ watchedEpisodes: 12, totalEpisodes: 12 }), null);
  assert.equal(nextProgress({ watchedEpisodes: 98, mediaType: 'vn', completedAt: '2020-01-01' }, now).changes.completedAt, '2020-01-01');
  assert.equal(nextProgress({ watchedEpisodes: 100, mediaType: 'vn' }), null);
  assert.equal(nextProgress({ watchedEpisodes: '3', totalEpisodes: 0 }).progress, 4);
  assert.equal(nextProgress({ watchedEpisodes: 11, episodeCount: 12 }).completed, true);
  assert.equal(nextProgress({ watchedEpisodes: 12, attributes: { episodeCount: 12 } }), null);
  assert.equal(nextProgress({ watchedEpisodes: Infinity, totalEpisodes: Infinity }).progress, 1);
});

test('actual quick handler retries concurrent writes without losing increments or duplicating activity', async () => {
  let value = { watchedEpisodes: 10, totalEpisodes: 12, title: 'Title', imageUrl: 'cover' };
  let version = 0;
  const activities = [];
  const toasts = [];
  const runTransaction = async (_db, callback) => {
    for (;;) {
      const readVersion = version;
      const readValue = { ...value };
      let changes;
      const result = await callback({ get: async () => snapshot(readValue), update: (_ref, update) => { changes = update; } });
      if (readVersion !== version) continue;
      if (changes) { value = { ...value, ...changes }; version++; }
      return result;
    }
  };
  const bindings = {
    db: {}, userId: 'me', username: 'Me', appId: 'app', doc: quiet, runTransaction,
    nextProgress, logActivity: activity => activities.push(activity), showToast: message => toasts.push(message),
  };
  const increment = handler('HomePage', 'handleQuickIncrement', bindings);
  const otherTab = handler('HomePage', 'handleQuickIncrement', bindings);
  const stale = { id: '1', watchedEpisodes: 0 };
  await Promise.all([increment(stale), otherTab(stale)]);
  await increment(stale);
  assert.equal(value.watchedEpisodes, 12);
  assert.equal(value.status, 'completed');
  assert.equal(activities.length, 2);
  assert.equal(toasts.length, 2);
});

test('pending progress blocks repeat clicks, releases after failures, and handles VN IDs', async () => {
  let release;
  let calls = 0;
  const activities = [], pending = { current: new Set() };
  const transaction = new Promise(resolve => { release = resolve; });
  const increment = handler('HomePage', 'handleQuickIncrement', { db: {}, userId: 'me', username: 'Me', appId: 'app', doc: quiet, nextProgress, pendingProgressRef: pending, runTransaction: async (_db, callback) => { calls++; await transaction; return callback({ get: async () => snapshot({ watchedEpisodes: 98, title: 'Novel' }), update: (_ref, changes) => assert.equal(changes.watchedEpisodes, 100) }); }, logActivity: item => activities.push(item), showToast: quiet });
  const first = increment({ id: 'v11' });
  await increment({ id: 'v11' });
  assert.equal(calls, 1); assert.equal(pending.current.size, 1);
  release(); await first;
  assert.equal(pending.current.size, 0); assert.equal(activities.length, 1); assert.match(activities[0].context, /read 100%/);
  const failed = handler('HomePage', 'handleQuickIncrement', { db: {}, userId: 'me', username: 'Me', appId: 'app', doc() { throw new Error('Invalid reference'); }, pendingProgressRef: pending, showToast: quiet, console: { error: quiet } });
  await failed({ id: 'x' }); assert.equal(pending.current.size, 0);
});

test('deleted quick-increment records are not recreated or logged', async () => {
  let logged = false;
  const increment = handler('HomePage', 'handleQuickIncrement', {
    db: {}, userId: 'me', username: 'Me', appId: 'app', doc: quiet, nextProgress,
    runTransaction: async (_db, callback) => callback({ get: async () => snapshot(undefined) }),
    logActivity: () => { logged = true; }, showToast: quiet, console: { error: quiet },
  });
  await increment({ id: 'gone' });
  assert.equal(logged, false);
});

test('decimal scores use integer buckets and exact values for mean and median', () => {
  const result = scoreSummary([0.5, 8.5, 9.4, 10, 0, -1, 11, Infinity, NaN, 'bad'].map(score => ({ score })));
  assert.equal(result.ratedCount, 4);
  assert.equal(result.counts.reduce((a, b) => a + b), 4);
  assert.equal(result.counts[0], 1);
  assert.equal(result.counts[8], 2);
  assert.equal(result.counts[9], 1);
  assert.equal(result.meanScore, '7.1');
  assert.equal(result.medianScore, '8.9');
  assert.deepEqual(scoreSummary([]), { counts: Array(10).fill(0), ratedCount: 0, meanScore: '0.0', medianScore: '0.0', maxCount: 1 });
});

test('title-only conflicts stay skipped with overwrite; source IDs are deduplicated', () => {
  const existing = [{ kitsuId: '123', title: 'Same Title' }, { kitsuId: 'anilist:2', title: 'Other' }];
  const entries = [{ kitsuId: 'anilist:1', title: 'Same Title' }, { kitsuId: 'anilist:2', title: 'Other' }, { kitsuId: 'anilist:3', title: 'New' }, { kitsuId: 'anilist:3', title: 'New' }];
  const plan = planImport(entries, existing, true, normalize);
  assert.deepEqual(plan.map(item => item.importable), [false, true, true, false]);
  assert.equal(plan[0].reason, 'Skip title-only match');
  assert.equal(plan[1].reason, 'Update exact ID');
  assert.deepEqual(planImport(entries, existing, false, normalize).map(item => item.importable), [false, false, true, false]);
});

test('merging import payload preserves private notes and settings', () => {
  const existing = { notes: 'private journal', shareNoteActivity: false, personalTags: ['private'], favorite: true };
  const entry = { notes: 'public imported note', score: 8.5, watchedEpisodes: 4 };
  assert.deepEqual({ ...existing, ...importPayload(entry, existing) }, { ...existing, score: 8.5, watchedEpisodes: 4 });
  assert.equal(importPayload(entry).notes, 'public imported note');
  assert.equal(entry.notes, 'public imported note');
});

test('actual import handler replans from server and skips cross-provider title conflicts', async () => {
  const writes = [];
  let imported;
  const entries = [{ kitsuId: 'anilist:1', title: 'Same' }, { kitsuId: 'anilist:2', title: 'Exact', notes: 'public', score: 9 }];
  const existing = { notes: 'private', shareNoteActivity: false, score: 4 };
  const run = handler('AniListImportPanel', 'importList', {
    preview: { entries, user: { name: 'Source' } }, importing: false, importableEntries: entries,
    updateExisting: true, db: {}, userId: 'me', appId: 'app',
    setImporting: quiet, setError: quiet, setFreshList: quiet, setLastImport: quiet, setPreview: quiet, setAniListUsername: quiet,
    collection: quiet, doc: (_db, _path, id) => ({ id }),
    getDocsFromServer: async () => querySnapshot([['kitsu:1', { title: 'Same' }], ['anilist:2', { title: 'Exact', ...existing }]]),
    runTransaction: async (_db, callback) => callback({ get: async () => snapshot(existing), set: (ref, payload) => writes.push({ ref, payload }) }),
    planImport, normalizeTitle: normalize, importPayload, onImported: result => { imported = result; }, showToast: quiet,
  });
  await run();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ref.id, 'anilist:2');
  assert.equal(writes[0].payload.notes, undefined);
  assert.equal(imported[0].notes, 'private');
  assert.equal(imported[0].shareNoteActivity, false);
});

test('actual import handler protects an exact ID created after preview when overwrite is off', async () => {
  let writes = 0;
  let imported;
  const entries = [{ kitsuId: 'anilist:1', title: 'New' }];
  const run = handler('AniListImportPanel', 'importList', {
    preview: { entries, user: { name: 'Source' } }, importing: false, importableEntries: entries, updateExisting: false,
    db: {}, userId: 'me', appId: 'app', setImporting: quiet, setError: quiet, setFreshList: quiet, setLastImport: quiet, setPreview: quiet, setAniListUsername: quiet,
    collection: quiet, doc: () => ({ id: 'anilist:1' }), getDocsFromServer: async () => querySnapshot([]),
    runTransaction: async (_db, callback) => callback({ get: async () => snapshot({ notes: 'new private data' }), set: () => writes++ }),
    planImport, normalizeTitle: normalize, importPayload, onImported: result => { imported = result; }, showToast: quiet,
  });
  await run();
  assert.equal(writes, 0);
  assert.deepEqual(imported, []);
});

function resetBindings(downloadBackup) {
  const deleted = [];
  const events = [];
  const records = new Map([
    ['fresh', { notes: 'private', watchedEpisodes: 10 }],
    ['activity', { noteContent: 'note' }],
  ]);
  const bindings = {
    confirmation: 'DELETE MY LIBRARY', confirmationPhrase: 'DELETE MY LIBRARY', isResetting: false, backupReady: true,
    db: {}, userId: 'me', username: 'Me', appId: 'app', myList: [{ title: 'stale' }],
    setIsResetting: quiet, setConfirmation: quiet, setIsOpen: quiet, onReset: quiet, showToast: quiet,
    doc: (_db, path) => path, collection: (_db, path) => path, query: ref => ref, where: quiet,
    getDocFromServer: async () => snapshot({ hallOfFame: ['favorite'] }),
    getDocsFromServer: async path => path.endsWith('animeList')
      ? querySnapshot([['fresh', { notes: 'private', watchedEpisodes: 10 }]])
      : path === 'interactions' ? querySnapshot([['reply', { text: 'reply' }]])
      : querySnapshot([['activity', { noteContent: 'note' }]]),
    downloadBackup: payload => { events.push('backup'); downloadBackup(payload); }, resetBackup,
    snapshotEqual: (left, right) => JSON.stringify(left.data()) === JSON.stringify(right.data()),
    runTransaction: async (_db, callback) => {
      const pendingDeletes = [];
      let clearHall = false;
      const result = await callback({
        get: async ref => snapshot(records.has(ref) ? records.get(ref) : { hallOfFame: ['favorite'] }, ref),
        delete: ref => pendingDeletes.push(ref), update: () => { clearHall = true; },
      });
      deleted.push(...pendingDeletes);
      if (pendingDeletes.length) events.push('delete');
      if (clearHall) events.push('clearHall');
      return result;
    }, console: { error: quiet },
  };
  return { bindings, deleted, events, records };
}

test('actual reset backs up fresh records, private fields, IDs, replies and Hall of Fame before deleting', async () => {
  let backup;
  const { bindings, deleted, events } = resetBindings(payload => { backup = payload; });
  await handler('LibraryResetPanel', 'resetLibrary', bindings)();
  assert.deepEqual(backup.animeList, [{ id: 'fresh', notes: 'private', watchedEpisodes: 10 }]);
  assert.deepEqual(backup.hallOfFame, ['favorite']);
  assert.equal(backup.activity[0].id, 'activity');
  assert.equal(backup.activity[0].interactions[0].text, 'reply');
  assert.deepEqual(deleted, ['fresh', 'activity']);
  assert.deepEqual(events, ['backup', 'delete', 'clearHall']);
});

test('reset never deletes after backup creation or fresh-read failure', async () => {
  const failedBackup = resetBindings(() => { throw new Error('Cannot create backup'); });
  await handler('LibraryResetPanel', 'resetLibrary', failedBackup.bindings)();
  assert.deepEqual(failedBackup.deleted, []);
  const failedRead = resetBindings(quiet);
  failedRead.bindings.getDocsFromServer = async () => { throw new Error('Offline'); };
  await handler('LibraryResetPanel', 'resetLibrary', failedRead.bindings)();
  assert.deepEqual(failedRead.deleted, []);
});

test('reset refuses to delete a record edited after its backup was taken', async () => {
  const state = resetBindings(() => { state.records.set('fresh', { notes: 'new private note', watchedEpisodes: 11 }); });
  await handler('LibraryResetPanel', 'resetLibrary', state.bindings)();
  assert.deepEqual(state.deleted, []);
  assert.deepEqual(state.events, ['backup']);
});

test('deck additions preserve existing logs and never copy another user rating', async () => {
  const records = new Map([['anilist:1', { score: 8.5, notes: 'My note', watchedEpisodes: 7 }]]);
  const add = handler('DecksPage', 'addDeckToLibrary', {
    db: {}, userId: 'me', readOnly: false, appId: 'app', showToast: quiet,
    doc: (_db, _path, id) => id,
    runTransaction: async (_db, callback) => callback({
      get: async id => snapshot(records.get(id), id),
      set: (id, value) => records.set(id, value),
    }),
  });
  await add({ items: [
    { kitsuId: 'anilist:1', title: 'Existing', score: 1 },
    { kitsuId: 'anilist:2', title: 'New', score: 10, watchedEpisodes: 12, notes: 'Creator note' },
    { kitsuId: 'anilist:2', title: 'Duplicate' },
  ] });
  assert.deepEqual(records.get('anilist:1'), { score: 8.5, notes: 'My note', watchedEpisodes: 7 });
  assert.equal(records.size, 2);
  assert.equal(records.get('anilist:2').score, 0);
  assert.equal(records.get('anilist:2').notes, '');
  assert.equal(records.get('anilist:2').watchedEpisodes, 0);
  assert.equal(records.get('anilist:2').status, 'planned');
});
