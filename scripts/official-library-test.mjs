import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8');
// Static layout contract from the official d651a44 design, independent of Git history.
const officialHomeClasses = [
  'flex flex-col space-y-8',
  'relative w-full h-72 rounded-3xl overflow-hidden shadow-2xl group cursor-pointer border border-white/10',
  'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6',
];
const parse = text => ts.createSourceFile('Pages.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const ast = parse(source);
const component = (name, tree = ast) => tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
const tracking = await readFile(new URL('../services/tracking.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(tracking, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { scoreSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function initializer(name, variable, bindings) {
  let value;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === variable) value = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(component(name));
  assert.ok(value, `${name}.${variable}`);
  const js = ts.transpileModule(`const result = ${value.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${js}\nreturn result;`)(...Object.values(bindings));
}

// Render the actual component with deterministic hooks; Firestore effects stay inactive.
function render(name, state, context = {}) {
  const node = component(name);
  const stateNames = [];
  for (const statement of node.body.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isArrayBindingPattern(declaration.name) && declaration.initializer?.expression?.getText(ast) === 'useState') {
        stateNames.push(declaration.name.elements[0].name.text);
      }
    }
  }
  let index = 0;
  const theme = { accentText: 'text-blue-400', progressbar: 'bg-blue-500', gradient: 'from-blue-400 to-purple-400', accentBorder: 'border-blue-500' };
  const stub = label => props => React.createElement('div', { 'data-component': label }, props.children);
  const bindings = {
    React, useState: initial => {
      const key = stateNames[index++];
      return [Object.hasOwn(state, key) ? state[key] : typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect: () => {}, useMemo: callback => callback(),
    useContext: () => ({ theme, viewMode: 'grid', ...context }), ThemeContext: {},
    localStorage: { getItem: () => '[]' }, scoreSummary, AVG_EPISODE_MINUTES: 24,
    motion: new Proxy({}, { get: (_target, tag) => ({ children, className, title }) => React.createElement(tag, { className, title }, children) }),
    LayoutGroup: React.Fragment, AnimatePresence: ({ children }) => children,
    JournalView: ({ list }) => React.createElement('div', { 'data-component': 'JournalView' }, list.map(item => item.title).join(',')),
    AnimeCard: ({ anime }) => React.createElement('div', { 'data-component': 'AnimeCard' }, anime.title),
    AnimeCardSkeleton: stub('Skeleton'), AnimeCarouselSkeleton: stub('Loading'),
    AnimeCarousel: ({ title, animeList }) => React.createElement('section', { 'data-carousel': title }, animeList.map(item => item.title).join(',')),
    GenreRadarChart: stub('GenreRadarChart'),
    ...Object.fromEntries(['PlayIcon', 'SearchIcon', 'CloseIcon', 'DiceIcon', 'PlusIcon', 'ViewGridIcon', 'ViewListIcon', 'CommentIcon'].map(key => [key, () => React.createElement('i')])),
  };
  const js = ts.transpileModule(node.getText(ast).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const Page = new Function(...Object.keys(bindings), `${js}\nreturn ${name};`)(...Object.values(bindings));
  return renderToStaticMarkup(React.createElement(Page, { db: {}, userId: 'test', username: 'Viewer' }));
}

const list = [
  { id: 'a', title: 'Active Anime', status: 'watching', watchedEpisodes: '3', totalEpisodes: 12, score: 8.5, favorite: true, priority: 'high', personalTags: ['weekend'], updatedAt: 1 },
  { id: 'b', title: 'Finished Anime', status: 'completed', watchedEpisodes: 12, totalEpisodes: '12', durationMinutes: 20, score: 10, completedAt: '2026-11-01' },
  { id: 'c', title: 'Finished VN', status: 'completed', mediaType: 'vn', watchedEpisodes: 100, vnPlaytimeHours: 5, score: 9.4, completedAt: '2026-10-01' },
  { id: 'd', title: 'Paused', status: 'paused', watchedEpisodes: 99, totalEpisodes: 2, score: 0 },
  { id: 'e', title: 'Backlog', status: 'planned', score: 0 },
];

test('Home preserves official greeting, hero geometry, and library grid without dashboard rows', () => {
  const html = render('HomePage', { myList: list, loading: false, heroAnime: list[0] });
  for (const className of officialHomeClasses) {
    assert.ok(html.includes(className));
  }
  assert.ok(html.indexOf('Welcome back, Viewer.') < html.indexOf('Continue Watching'));
  assert.ok(html.indexOf('Continue Watching') < html.indexOf('data-component="AnimeCard"'));
  assert.ok(!html.includes('Up next'));
  assert.match(html, /<details[^>]*><summary[^>]*>Library Tools/);
  assert.match(html, />paused<\/button>/);
});

test('Home retains all secondary filters and Journal respects the filtered library', () => {
  const defaults = { myList: list, statusFilter: 'watching', mediaFilter: 'all', localQuery: '', collectionFilter: 'all', tagFilter: 'all', sortBy: 'updated', useMemo: callback => callback() };
  for (const collectionFilter of ['favorites', 'priority', 'stale', 'all']) {
    assert.deepEqual(initializer('HomePage', 'filteredList', { ...defaults, collectionFilter }).map(item => item.id), ['a']);
  }
  assert.deepEqual(initializer('HomePage', 'filteredList', { ...defaults, collectionFilter: 'unrated' }), []);
  assert.deepEqual(initializer('HomePage', 'filteredList', { ...defaults, tagFilter: 'missing' }), []);
  assert.deepEqual(initializer('HomePage', 'filteredList', { ...defaults, statusFilter: 'paused' }).map(item => item.id), ['d']);
  const journal = render('HomePage', { myList: list, loading: false, heroAnime: null }, { viewMode: 'journal' });
  assert.match(journal, /data-component="JournalView">Active Anime/);
  assert.ok(!journal.includes('data-component="AnimeCard"'));
  assert.match(journal, /title="Grid"/);
  assert.match(journal, /title="List"/);
  assert.match(journal, /title="Journal"/);
});

test('Stats isolates analytics from library writes and exposes load failures', () => {
  const stats = component('StatsPage').getText(ast);
  assert.match(stats, /AnalyticsDashboard/);
  assert.match(stats, /id: item.id/);
  assert.match(stats, /role="alert"/);
  assert.doesNotMatch(stats, /updateDoc|setDoc|fetch\(/);
});
