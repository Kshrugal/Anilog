import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const cacheSource = await readFile(new URL('../services/media-cache.ts', import.meta.url), 'utf8');
const cacheUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(cacheSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')}`;
const source = (await readFile(new URL('../services/anilist.ts', import.meta.url), 'utf8')).replace("'./media-cache'", `'${cacheUrl}'`);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const api = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function mockTimeout(t) {
  let fire;
  let cleared = false;
  const handle = {};
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    assert.equal(delay, 15_000);
    fire = callback;
    return handle;
  });
  t.mock.method(globalThis, 'clearTimeout', value => {
    assert.equal(value, handle);
    cleared = true;
  });
  return { fire: () => fire(), get cleared() { return cleared; } };
}

function mockPayload(t, payload, { ok = true, status = 200 } = {}) {
  return t.mock.method(globalThis, 'fetch', async () => ({
    ok, status, json: async () => payload,
  }));
}

test('Discover shares its public request and reuses recent results', async t => {
  const fetch = mockPayload(t, { data: { trending: { media: [] } } });
  const first = api.getAniListDiscovery(3);
  const second = api.getAniListDiscovery(3);
  assert.deepEqual(await first, await second);
  await api.getAniListDiscovery(3);
  assert.equal(fetch.mock.callCount(), 1);
});

test('search keeps its timeout active through body parsing and maps results', async t => {
  const timer = mockTimeout(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://graphql.anilist.co');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body).variables, { search: 'Example', perPage: 7 });
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => {
      assert.equal(timer.cleared, false);
      return { data: { Page: { media: [{ id: 1, title: { english: 'Example' }, description: null }] } } };
    } };
  });
  const result = await api.searchAniList('Example', 7);
  assert.equal(result[0].id, 'anilist:1');
  assert.equal(result[0].attributes.canonicalTitle, 'Example');
  assert.equal(result[0].attributes.synopsis, '');
  assert.equal(timer.cleared, true);
});

for (const phase of ['headers', 'body']) {
  test(`timeout aborts stalled ${phase} and returns the friendly error`, async t => {
    const timer = mockTimeout(t);
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
      const stall = () => new Promise((_resolve, reject) => {
        assert.equal(timer.cleared, false);
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        timer.fire();
      });
      return phase === 'headers' ? stall() : { ok: true, json: stall };
    });
    await assert.rejects(api.searchAniList('Example'), error => {
      assert.match(error.message, /AniList took too long/);
      assert.equal(error.cause.name, 'AbortError');
      return true;
    });
    assert.equal(timer.cleared, true);
  });
}

for (const phase of ['fetch', 'json']) {
  test(`${phase} failures preserve the original error and clear the timer`, async t => {
    const timer = mockTimeout(t);
    const failure = new Error(`${phase} failed`);
    t.mock.method(globalThis, 'fetch', async () => {
      if (phase === 'fetch') throw failure;
      return { ok: true, json: async () => { throw failure; } };
    });
    await assert.rejects(api.searchAniList('Example'), error => error === failure);
    assert.equal(timer.cleared, true);
  });
}

test('GraphQL and HTTP failures reject and clear their timers', async t => {
  const timer = mockTimeout(t);
  const fetchMock = mockPayload(t, { errors: [{ message: 'Rate limited' }] });
  await assert.rejects(api.searchAniList('Example'), /Rate limited/);
  assert.equal(timer.cleared, true);
  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  await assert.rejects(api.searchAniList('Example'), /AniList request failed \(503\)/);
});

function entry(id, overrides = {}) {
  return {
    media: { id, title: { english: `Anime ${id}` }, episodes: 12, genres: ['Drama'] },
    status: 'CURRENT', progress: 3, score: 8.5, notes: 'Public note', private: false,
    repeat: 2, startedAt: { year: 2025, month: 4, day: 6 }, updatedAt: 123,
    ...overrides,
  };
}

function collection(lists) {
  return { data: { MediaListCollection: { user: { id: 9, name: 'Viewer' }, lists } } };
}

test('import deduplicates IDs across standard/custom lists and preserves mapped fields', async t => {
  mockPayload(t, collection([
    { entries: [entry(1), entry(2, { status: 'COMPLETED' })] },
    { entries: [entry(1), entry(2, { status: 'COMPLETED' })] },
  ]));
  const result = await api.getAniListUserAnimeList('Viewer');
  assert.equal(result.user.name, 'Viewer');
  assert.deepEqual(result.entries.map(item => item.kitsuId), ['anilist:1', 'anilist:2']);
  const first = result.entries[0];
  assert.equal(first.status, 'watching');
  assert.equal(first.watchedEpisodes, 3);
  assert.equal(first.score, 8.5);
  assert.equal(first.notes, 'Public note');
  assert.equal(first.repeatCount, 2);
  assert.equal(first.startedAt, '2025-04-06');
  assert.equal(first.updatedAt, 123_000);
  assert.equal(result.entries[1].status, 'completed');
});

test('private imports are excluded even when a public duplicate comes first', async t => {
  mockPayload(t, collection([
    { entries: [entry(1, { notes: 'Must not leak' }), entry(2, { private: true, notes: 'Secret' })] },
    { entries: [entry(1, { private: true }), entry(3)] },
  ]));
  const result = await api.getAniListUserAnimeList('Viewer');
  assert.deepEqual(result.entries.map(item => item.kitsuId), ['anilist:3']);
  assert.doesNotMatch(JSON.stringify(result), /Must not leak|Secret/);
});

test('import skips missing media and tolerates empty or missing collections', async t => {
  const fetchMock = mockPayload(t, collection([{ entries: [entry(1, { media: null }), entry(2)] }, {}]));
  assert.deepEqual((await api.getAniListUserAnimeList('Viewer')).entries.map(item => item.kitsuId), ['anilist:2']);
  fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ data: { MediaListCollection: null } }) }));
  assert.deepEqual(await api.getAniListUserAnimeList('Viewer'), { user: undefined, entries: [] });
});
