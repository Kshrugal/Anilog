import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const source = await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8');
const franchiseSource = await readFile(new URL('../services/franchises.ts', import.meta.url), 'utf8');
const franchiseUrl = `data:text/javascript;base64,${Buffer.from(compile(franchiseSource)).toString('base64')}`;
const helpers = await import(`data:text/javascript;base64,${Buffer.from(compile(source).replace(/from ['"]\.\/franchises['"]/, `from '${franchiseUrl}'`)).toString('base64')}`);
const { analyze, timeFor, suggestedGroup, remainingAnime } = helpers;
const entries = [
  { id: '1', title: 'Story', status: 'completed', totalEpisodes: '12', watchedEpisodes: '99', durationMinutes: 20, score: 8.5, completedAt: '2026-11-01', repeatCount: 2 },
  { id: '2', title: 'Story Season 2', status: 'completed', totalEpisodes: 12, score: 9.4 },
  { id: '3', title: '星', status: 'completed', watchedEpisodes: 3, score: '10', completedAt: '2026-02-31' },
  { id: '4', title: '夜', status: 'on_hold', watchedEpisodes: 3, totalEpisodes: 2 },
  { id: 'v1', title: 'Novel', status: 'reading', watchedEpisodes: 80, vnPlaytimeHours: '5' },
  { id: 'v2', title: 'Other Novel', status: 'completed', watchedEpisodes: 100 },
  { id: '5', title: 'Future', status: 'planning', totalEpisodes: 12, watchedEpisodes: 0 },
];
test('separate listing counts and reproducible legacy grouping, without non-Latin merging in explorer', () => {
  const result = analyze(entries);
  assert.equal(result.completedAnime, 3); assert.equal(result.completedVns, 1);
  assert.equal(result.legacyCompletedGroups, 2);
  assert.equal(result.groups.find(g => g.name === 'Story').entries.length, 2);
  assert.ok(result.groups.find(g => g.name === '星')); assert.ok(result.groups.find(g => g.name === '夜'));
  assert.equal(result.statuses.paused, 1); assert.equal(result.statuses.watching, 1); assert.equal(result.statuses.planned, 1);
});
test('numeric bounded progress, real VN logged hours only, explicit repeat assumption', () => {
  const result = analyze(entries);
  assert.equal(result.episodes, 29); assert.equal(result.minutes, 948);
  assert.equal(result.estimatedTitles, 3); assert.equal(result.missingVnTime, 1);
  assert.equal(timeFor(entries[0], true).episodes, 36);
  assert.equal(timeFor(entries[4], true).minutes, 300);
  assert.equal(timeFor({ watchedEpisodes: Infinity, totalEpisodes: 'bad', durationMinutes: -1 }).minutes, 0);
});
test('exact decimal ratings and upper-inclusive bins exclude invalid scores', () => {
  const result = analyze([...entries, { score: -4 }, { score: 11 }, { score: Infinity }]);
  assert.equal(result.rated, 3); assert.equal(result.median, 9.4); assert.equal(result.mean, 27.9 / 3);
  assert.equal(result.buckets[8].length, 1); assert.equal(result.buckets[9].length, 2);
});
test('valid completion dates only; custom groups cannot change title counts or mutate library', () => {
  const before = JSON.stringify(entries); const result = analyze(entries, { '1': 'Custom', '2': 'Custom' });
  assert.equal(result.years['2026'].entries.length, 1); assert.equal(result.undatedCompleted, 3);
  assert.equal(result.completedAnime, 3); assert.equal(result.groups.find(g => g.name === 'Custom').entries.length, 2);
  assert.equal(JSON.stringify(entries), before);
  assert.equal(suggestedGroup('Story II'), 'Story'); assert.equal(suggestedGroup('星'), '星');
});
test('backlog excludes VNs and finished/dropped titles; missing totals stay unknown', () => {
  assert.deepEqual(remainingAnime([...entries, { status: 'watching' }]), { minutes: 288, unknown: 1 });
  const empty = analyze([]); assert.equal(empty.mean, 0); assert.equal(empty.median, 0); assert.equal(empty.minutes, 0);
});
test('manga context cannot inflate completed anime, episode counts, or anime queue time', () => {
  const manga = { id: 'anilist:30012', title: 'Bleach', mediaType: 'manga', status: 'completed', watchedEpisodes: 700, totalEpisodes: 700 };
  const result = analyze([manga]);
  assert.equal(result.completedAnime, 0); assert.equal(result.completedManga, 1); assert.equal(result.episodes, 0); assert.equal(result.minutes, 0);
  assert.equal(remainingAnime([{ ...manga, status: 'watching' }]).minutes, 0);
});
const dashboardSource = await readFile(new URL('../features/Analytics.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('Analytics.tsx', dashboardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = tree.statements.filter(ts.isImportDeclaration).length;
const body = tree.statements.slice(declarations).map(n => n.getText(tree).replace(/^export /, '')).join('\n');
function render(tab, format = 'all', data = entries) {
  let index = 0;
  const state = { 0: tab, 2: format };
  const iconBindings = Object.fromEntries(['ChevronDown', 'Pencil', 'RotateCcw', 'Search', 'X', 'Clock3', 'Layers3', 'Check', 'BookOpen', 'Tv'].map(name => [name, icons[name]]));
  const binding = { React, ...helpers, ...iconBindings, useFranchiseCatalogue: () => ({ catalogue: {}, state: { loading: false, done: 0, total: data.length }, retry() {} }), useMemo: callback => callback(), useState: initial => [Object.hasOwn(state, index) ? state[index++] : (index++, typeof initial === 'function' ? initial() : initial), () => {}], localStorage: { getItem: () => '{}' } };
  const js = compile(body).replace(/export \{\};?/, '');
  const Dashboard = new Function(...Object.keys(binding), `${js}\nreturn AnalyticsDashboard;`)(...Object.values(binding));
  return renderToStaticMarkup(React.createElement(Dashboard, { entries: data, userId: 'test', onSelect() {} }));
}
test('all analytics tabs render real fixture and empty states without invalid numbers', () => {
  for (const tab of ['overview', 'franchises', 'timeline', 'lab']) for (const data of [entries, []]) {
    const html = render(tab, 'all', data); assert.ok(!/NaN|Infinity/.test(html)); assert.match(html, /Counting &amp; estimates/);
  }
  assert.match(render('overview'), /h-32/);
  assert.match(render('franchises'), /Edit group for Story/);
  assert.match(render('lab'), /Daily minutes/);
  assert.match(render('timeline'), /Completion year/);
});
