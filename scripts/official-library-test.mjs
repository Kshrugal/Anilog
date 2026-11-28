import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8');
// Keep the official visual family while the practical-home phase tightens vertical space.
const officialHomeClasses = [
  'flex flex-col space-y-6',
  'relative w-full h-64 sm:h-56 lg:h-auto lg:min-h-56 rounded-3xl overflow-hidden shadow-2xl group cursor-pointer border border-white/10',
  'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6',
];
const parse = text => ts.createSourceFile('Pages.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const ast = parse(source);
const component = (name, tree = ast) => tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
const tracking = await readFile(new URL('../services/tracking.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(tracking, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { scoreSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const profileSource = await readFile(new URL('../services/profile.ts', import.meta.url), 'utf8');
const profileUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(profileSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`;
const trackingUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const homeSource = (await readFile(new URL('../services/home-library.ts', import.meta.url), 'utf8')).replace("from './profile'", `from '${profileUrl}'`).replace("from './tracking'", `from '${trackingUrl}'`);
const home = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(homeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
const resumeSource = await readFile(new URL('../features/HomeResume.tsx', import.meta.url), 'utf8');
const resumeTree = parse(resumeSource);
const resumeBody = resumeTree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(resumeTree).replace(/^export /, '')).join('\n');
const activitySource = await readFile(new URL('../features/HomeActivity.tsx', import.meta.url), 'utf8');
const activityTree = parse(activitySource);
const activityBody = activityTree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(activityTree).replace(/^export /, '')).join('\n');
const profile = await import(profileUrl);

function initializer(name, variable, bindings) {
  bindings = { profileLibrary: profile.profileLibrary, ...bindings };
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
    React, ...home, ...profile, useRef: value => ({ current: value }), useState: initial => {
      const key = stateNames[index++];
      return [Object.hasOwn(state, key) ? state[key] : typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect: () => {}, useMemo: callback => callback(), useCallback: callback => callback,
    useContext: () => ({ theme, viewMode: 'grid', ...context }), ThemeContext: {},
    localStorage: { getItem: () => '[]' }, scoreSummary, AVG_EPISODE_MINUTES: 24, appId: 'test',
    motion: new Proxy({}, { get: (_target, tag) => ({ children, className, title }) => React.createElement(tag, { className, title }, children) }),
    LayoutGroup: React.Fragment, AnimatePresence: ({ children }) => children,
    LibraryGrid: ({ children, className }) => React.createElement('div', { className }, children),
    JournalView: ({ list }) => React.createElement('div', { 'data-component': 'JournalView' }, list.map(item => item.title).join(',')),
    AnimeCard: ({ anime }) => React.createElement('div', { 'data-component': 'AnimeCard' }, anime.title),
    AnimeCardSkeleton: stub('Skeleton'), AnimeCarouselSkeleton: stub('Loading'),
    AnimeCarousel: ({ title, animeList }) => React.createElement('section', { 'data-carousel': title }, animeList.map(item => item.title).join(',')),
    GenreRadarChart: stub('GenreRadarChart'),
    ...Object.fromEntries(['PlayIcon', 'SearchIcon', 'CloseIcon', 'DiceIcon', 'PlusIcon', 'ViewGridIcon', 'ViewListIcon', 'CommentIcon'].map(key => [key, () => React.createElement('i')])),
  };
  bindings.HomeResume = new Function('React', 'motion', 'profileIsVn', 'profileProgress', 'progressCommand', 'BookOpen', 'Check', 'ChevronDown', 'Loader2', 'Tv', `${ts.transpileModule(resumeBody, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText};return HomeResume;`)(React, bindings.motion, profile.profileIsVn, profile.profileProgress, home.progressCommand, 'i', 'i', 'i', 'i', 'i');
  const activityState = initial => {
    const fixtures = { loading: 'ready', all: state.activityFilter || 'all' };
    return [Array.isArray(initial) ? state.activityItems || [] : fixtures[String(initial)], () => {}];
  };
  bindings.HomeActivity = new Function('React', 'useState', 'useEffect', 'useCommunityPortraits', 'CommunityAvatar', 'ArrowRight', 'activityTitle', `${ts.transpileModule(activityBody, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText};return HomeActivity;`)(React, activityState, () => {}, () => ({}), stub('Avatar'), 'i', item => item.animeKitsuId ? { kitsuId: item.animeKitsuId } : null);
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

test('Home keeps the resume hero first and shows recent activity above the library grid', () => {
  const html = render('HomePage', { myList: list, loading: false, activityItems: [
    { id: 'progress', username: 'Viewer', context: 'watched episodes 2–4 of', animeTitle: 'Active Anime', animeKitsuId: 'anilist:20' },
    { id: 'review', username: 'Friend', type: 'micro_review', context: 'reviewed', animeTitle: 'Finished Anime', spoiler: true, noteContent: 'Hidden ending' },
  ] });
  for (const className of officialHomeClasses) {
    assert.ok(html.includes(className));
  }
  assert.ok(html.indexOf('Welcome back, Viewer.') < html.indexOf('Continue Watching'));
  assert.ok(html.indexOf('Continue Watching') < html.indexOf('Recent activity'));
  assert.ok(html.indexOf('Recent activity') < html.indexOf('data-component="AnimeCard"'));
  assert.match(html, /View activity/);
  assert.match(html, /watched episodes 2–4 of/);
  assert.match(html, /<button[^>]*>Active Anime<\/button>/);
  assert.match(html, /Contains spoilers/);
  assert.doesNotMatch(html, /Hidden ending/);
  assert.ok(!html.includes('Up next'));
  assert.match(html, /<details[^>]*><summary[^>]*>Library Tools/);
  assert.match(html, /Paused<span/);
});

test('Home activity shows dated rows, a selected filter and a link to the full feed', () => {
  const activityItems = Array.from({ length: 4 }, (_, index) => ({
    id: String(index), username: 'Friend', context: `posted update ${index + 1}`, timestamp: { seconds: 86400 },
  }));
  const state = { myList: list, loading: false, activityItems, activityFilter: 'following' };
  const html = render('HomePage', state);
  assert.match(html, /aria-pressed="true"[^>]*>Following/);
  assert.match(html, /datetime="1970-01-02T00:00:00.000Z"/i);
  assert.match(html, /posted update 4/);
  assert.match(html, /View activity/);
  assert.doesNotMatch(html, /Show more|Show less/);
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
