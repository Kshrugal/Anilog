import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as icons from 'lucide-react';
import ts from 'typescript';
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const toUrl = text => `data:text/javascript;base64,${Buffer.from(compile(text)).toString('base64')}`;
const profile = await import(toUrl(await readFile(new URL('../services/profile.ts', import.meta.url), 'utf8')));
const franchiseUrl = toUrl(await readFile(new URL('../services/franchises.ts', import.meta.url), 'utf8'));
const analytics = await import(toUrl((await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8')).replace("from './franchises'", `from '${franchiseUrl}'`)));
const uiSource = await readFile(new URL('../features/PublicProfile.tsx', import.meta.url), 'utf8');
const uiTree = ts.createSourceFile('PublicProfile.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const iconNames = uiTree.statements.filter(ts.isImportDeclaration).find(n => n.moduleSpecifier.text === 'lucide-react').importClause.namedBindings.elements.map(n => n.name.text);
const iconBindings = Object.fromEntries(iconNames.map(n => [n, icons[n]]));
const uiBody = uiTree.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(uiTree).replace(/^export /, '')).join('\n');
const bindings = { React, useState: initial => [initial, () => {}], ...profile, ...iconBindings, AnimeCard: ({ anime }) => React.createElement('div', { 'data-tile': anime.title }, anime.title) };
const ui = new Function(...Object.keys(bindings), `${compile(uiBody)};return {PublicProfileHeader,PublicProfileOverview,PublicProfileFavorites};`)(...Object.values(bindings));
const entries = [
  { id: '1', kitsuId: '1', title: 'Watching fixture', status: 'watching', totalEpisodes: 12, watchedEpisodes: 3, imageUrl: 'https://example.test/anime.jpg' },
  { id: 'v1', kitsuId: 'v1', title: 'Reading fixture', status: 'watching', watchedEpisodes: 5, imageUrl: 'https://example.test/vn.jpg' },
  { id: '2', kitsuId: '2', title: 'Dropped fixture', status: 'dropped' },
].map(profile.profileEntry);
const stats = { completed: 1, meanScore: '8.5', hours: 14, eps: 3, daysConsumed: '0.6' };
test('immersive profile has real library media, tabs and follow actions without nested overview cards', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PublicProfileHeader, { name: 'Friend', entries, favorites: [], stats, tab: 'overview', canFollow: true }));
  assert.match(html, /anime\.jpg/); assert.match(html, /vn\.jpg/); assert.match(html, /Statistics/); assert.match(html, /Library/); assert.match(html, /Follow/);
  const overview = renderToStaticMarkup(React.createElement(ui.PublicProfileOverview, { entries, stats }));
  assert.match(overview, /Watching fixture/); assert.match(overview, /Reading fixture/);
  assert.doesNotMatch(overview, /data-tile="Dropped fixture"/);
  assert.match(overview, /Open entire library/);
});
test('private profile header never renders library images or counts', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PublicProfileHeader, { name: 'Friend', entries, favorites: entries, stats, privateLibrary: true }));
  assert.doesNotMatch(html, /<img|anime\.jpg|vn\.jpg|3 titles/);
  assert.match(html, /Private library/);
});
const walk = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)];
test('overview controls open complete status/format libraries and statistics', () => {
  const calls = [];
  const tree = ui.PublicProfileOverview({ entries, stats, onLibrary: (...args) => calls.push(args), onStats: () => calls.push('stats') });
  for (const button of walk(tree).filter(n => n.type === 'button' && n.props.onClick)) button.props.onClick();
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'all' && call[1] === 'dropped'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'vn' && call[1] === 'all'));
  assert.ok(calls.includes('stats'));
});
const pages = await readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('Pages.tsx', pages, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'UserProfilePage');
function renderProfile(state) {
  const names = component.body.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]).filter(n => ts.isArrayBindingPattern(n.name) && n.initializer?.expression?.getText(ast) === 'useState').map(n => n.name.elements[0].name.text);
  let index = 0;
  const values = { loadedTarget: { targetUid: 'friend', currentUserId: 'me', readOnly: false }, list: entries, loading: false, activityLoading: false, ...state };
  const bound = { React, ...profile, ...analytics, ...ui, useState: initial => { const name = names[index++]; return [Object.hasOwn(values, name) ? values[name] : typeof initial === 'function' ? initial() : initial, () => {}]; }, useMemo: callback => callback(), useEffect() {}, useContext: () => ({ theme: {} }), ThemeContext: {},
    useFranchiseCatalogue: () => ({ catalogue: {}, state: { loading: false } }),
    AnalyticsDashboard: props => React.createElement('div', { 'data-public-statistics': props.title, 'data-editable': String(props.editableGroups) }),
    ActivityHeatmap: () => React.createElement('div'), LockIcon: icons.Lock,
  };
  const Page = new Function(...Object.keys(bound), `${compile(component.getText(ast).replace(/^export /, ''))};return UserProfilePage;`)(...Object.values(bound));
  return renderToStaticMarkup(React.createElement(Page, { db: {}, currentUserId: 'me', targetUser: { uid: 'friend', username: 'Friend' }, readOnly: false }));
}
test('public statistics uses target library, disables grouping writes, and respects privacy/error guards', () => {
  const html = renderProfile({ tab: 'stats' });
  assert.match(html, /data-public-statistics="Friend&#x27;s Statistics"/); assert.match(html, /data-editable="false"/);
  assert.doesNotMatch(renderProfile({ tab: 'stats', libraryPrivate: true }), /data-public-statistics/);
  assert.doesNotMatch(renderProfile({ tab: 'stats', loadError: 'Permission denied' }), /data-public-statistics/);
});
