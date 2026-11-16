import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import ts from 'typescript';
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const toUrl = text => `data:text/javascript;base64,${Buffer.from(compile(text)).toString('base64')}`;
const franchises = toUrl(await readFile(new URL('../services/franchises.ts', import.meta.url), 'utf8'));
const helpers = await import(toUrl((await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8')).replace("from './franchises'", `from '${franchises}'`)));
const { analyze, timeFor, runtimeFor, exactTime, remainingAnime } = helpers;
const filmIds = [2593, 3782, 3783, 4280, 4282, 5204, 5205, 6954, 14807, 20697];
const durations = [50, 61, 58, 46, 114, 59, 121, 33, 89, 32];
const catalogue = Object.fromEntries(filmIds.map((id, i) => [`anilist:${id}`, { key: `anilist:${id}`, title: `Garden listing ${i + 1}`, durationMinutes: durations[i], episodeCount: 1, format: i === 7 ? 'OVA' : 'MOVIE', status: 'FINISHED', runtimeSource: 'AniList' }]));
const entries = filmIds.map((id, i) => ({ kitsuId: `anilist:${id}`, title: `Garden listing ${i + 1}`, status: 'completed', totalEpisodes: 1, watchedEpisodes: 1, durationMinutes: 24 }));
test('each Garden of Sinners listing uses its verified catalogue runtime, overriding stale 24-minute values', () => {
  const stats = analyze(entries, {}, false, { catalogue });
  assert.deepEqual(entries.map(e => stats.times[e.kitsuId].minutes), durations);
  assert.equal(stats.minutes, 663); assert.equal(exactTime(stats.minutes), '11h 3m');
  assert.equal(exactTime(stats.times['anilist:5205'].minutes), '2h 1m');
  assert.equal(stats.runtimeKnown, 10); assert.equal(stats.missingAnimeTime, 0);
});
test('TV hours use actual per-listing episode durations and bounded progress, not a blanket 24', () => {
  const library = [{ kitsuId: 'anilist:20', title: 'Naruto', status: 'completed', totalEpisodes: 220 }, { kitsuId: 'anilist:1735', title: 'Shippuden', status: 'completed', totalEpisodes: 500 }];
  const data = Object.fromEntries(library.map(e => [e.kitsuId, { key: e.kitsuId, title: e.title, episodeCount: e.totalEpisodes, durationMinutes: 23, status: 'FINISHED', runtimeSource: 'AniList' }]));
  assert.equal(analyze(library, {}, false, { catalogue: data }).minutes / 60, 276);
  assert.equal(timeFor({ ...library[0], status: 'watching', watchedEpisodes: 5 }, false, data).minutes, 115);
  assert.equal(timeFor({ ...library[0], status: 'watching', watchedEpisodes: 999 }, false, data).episodes, 220);
});
test('unknown runtimes stay unknown; no movie or show receives an invented duration', () => {
  const unknown = timeFor({ kitsuId: 'anilist:9', status: 'completed', totalEpisodes: 1, watchedEpisodes: 1, showType: 'MOVIE' });
  assert.equal(unknown.minutes, 0); assert.equal(unknown.unknown, true); assert.equal(unknown.fullMinutes, null);
  const missingCount = timeFor({ status: 'completed', durationMinutes: 40 });
  assert.equal(missingCount.unknown, true);
  assert.equal(runtimeFor({ showType: 'MOVIE', durationMinutes: 121 }).total, 1);
});
test('airing and unreleased titles do not invent future viewing or repeat full unaired seasons', () => {
  const entry = { kitsuId: 'anilist:9', status: 'completed', watchedEpisodes: 24, repeatCount: 1 };
  const ongoing = { 'anilist:9': { key: 'anilist:9', title: 'Airing', durationMinutes: 25, episodeCount: 24, status: 'RELEASING', airedEpisodes: 6 } };
  assert.equal(timeFor(entry, true, ongoing).minutes, 150);
  ongoing['anilist:9'].status = 'NOT_YET_RELEASED';
  assert.equal(timeFor(entry, true, ongoing).minutes, 0);
});
test('rewatches are optional full known cycles; VN percentages never become guessed hours', () => {
  const entry = { ...entries[0], repeatCount: 2 };
  assert.equal(timeFor(entry, false, catalogue).minutes, 50);
  assert.equal(timeFor(entry, true, catalogue).minutes, 150);
  assert.equal(timeFor({ kitsuId: 'v7', mediaType: 'vn', status: 'completed', watchedEpisodes: 100 }).unknown, true);
  assert.equal(timeFor({ kitsuId: 'v7', mediaType: 'vn', status: 'watching', watchedEpisodes: 5, vnPlaytimeHours: 70 }).minutes, 4200);
});
test('backlog, profile analytics and source links use the same runtime metadata', () => {
  assert.equal(remainingAnime([{ ...entries[0], status: 'planned', watchedEpisodes: 0 }], catalogue).minutes, 50);
  const alias = { 'anilist:2593': { ...catalogue['anilist:2593'], aliases: ['kitsu:100'] } };
  assert.equal(runtimeFor({ kitsuId: '100' }, alias).sourceUrl, 'https://anilist.co/anime/2593');
  assert.equal(analyze(entries, {}, false, { catalogue }).minutes, entries.reduce((sum, e) => sum + timeFor(e, false, catalogue).minutes, 0));
});
const audit = await readFile(new URL('../features/RuntimeAudit.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('RuntimeAudit.tsx', audit, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const body = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast).replace(/^export /, '')).join('\n');
function renderAudit({ search = '', filter = 'all', page = 0 } = {}) {
  let index = 0; const states = [search, filter, page];
  const bindings = { React, ...helpers, useState: () => [states[index++], () => {}], useMemo: callback => callback(), Search: icons.Search, ChevronLeft: icons.ChevronLeft, ChevronRight: icons.ChevronRight, ExternalLink: icons.ExternalLink };
  const Component = new Function(...Object.keys(bindings), `${compile(body)};return RuntimeAudit;`)(...Object.values(bindings));
  return renderToStaticMarkup(React.createElement(Component, { entries, times: analyze(entries, {}, false, { catalogue }).times, onSelect() {} }));
}
test('audit exposes exact minutes, per-title calculations, sources and missing-data filters', () => {
  const html = renderAudit();
  assert.match(html, /2h 1m/); assert.match(html, /50m/); assert.match(html, /1 × 121 min/); assert.match(html, /https:\/\/anilist.co\/anime\/5205/);
  assert.match(renderAudit({ filter: 'missing' }), /No matching listings/);
  assert.match(renderAudit({ search: 'Garden listing 7' }), /2h 1m/);
  assert.doesNotMatch(html, /0\.4h/);
});

const pagesSource = await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8');
const pages = ts.createSourceFile('Pages.tsx', pagesSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const profilePage = pages.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ProfilePage');
let privacyHandler;
function find(node) { if (ts.isVariableDeclaration(node) && node.name.getText(pages) === 'handleLibraryPrivacyToggle') privacyHandler = node.initializer; ts.forEachChild(node, find); }
find(profilePage);
test('privacy switch keeps its old value when saving fails and blocks repeated pending actions', async () => {
  const changes = [], writes = [];
  const bindings = { db: {}, userId: 'owner', privacySaving: false, libraryPublic: true, appId: 'test', doc: (_db, path) => path, updateDoc: async (...args) => { writes.push(args); throw new Error('Offline'); }, setPrivacySaving: value => changes.push(['busy', value]), setLibraryPublic: value => changes.push(['public', value]), showToast: (...args) => changes.push(['toast', ...args]) };
  const handler = b => new Function(...Object.keys(b), `${compile(`const handler = ${privacyHandler.getText(pages)};`)};return handler;`)(...Object.values(b));
  await handler(bindings)();
  assert.equal(writes.length, 1); assert.equal(changes.some(c => c[0] === 'public'), false); assert.deepEqual(changes.at(-1), ['busy', false]);
  await handler({ ...bindings, privacySaving: true })(); assert.equal(writes.length, 1);
  assert.match(pagesSource, /role="switch" aria-checked=\{libraryPublic\}/);
  assert.match(pagesSource, /absolute left-1 top-1 h-4 w-4/);
});
