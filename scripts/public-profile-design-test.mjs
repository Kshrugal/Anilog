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
const identity = await import(toUrl(await readFile(new URL('../services/profile-identity.ts', import.meta.url), 'utf8')));
const franchiseUrl = toUrl(await readFile(new URL('../services/franchises.ts', import.meta.url), 'utf8'));
const analytics = await import(toUrl((await readFile(new URL('../services/analytics.ts', import.meta.url), 'utf8')).replace("from './franchises'", `from '${franchiseUrl}'`)));
const uiSource = await readFile(new URL('../features/PublicProfile.tsx', import.meta.url), 'utf8');
const uiTree = ts.createSourceFile('PublicProfile.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const iconNames = uiTree.statements.filter(ts.isImportDeclaration).find(n => n.moduleSpecifier.text === 'lucide-react').importClause.namedBindings.elements;
const iconBindings = Object.fromEntries(iconNames.map(n => [n.name.text, icons[n.propertyName?.text || n.name.text]]));
const uiBody = uiTree.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(uiTree).replace(/^export /, '')).join('\n');
const bioTree = ts.createSourceFile('ProfileBio.tsx', await readFile(new URL('../features/ProfileBio.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const bioBody = bioTree.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(bioTree).replace(/^export /, '')).join('\n');
const { ProfileBio } = new Function('React', `${compile(bioBody)};return {ProfileBio};`)(React);
const bindings = { React, ProfileBio, IdentityImage: () => null, useState: initial => [initial, () => {}], ...profile, ...iconBindings, AnimeCard: ({ anime }) => React.createElement('div', { 'data-tile': anime.title }, anime.title) };
const ui = new Function(...Object.keys(bindings), `${compile(uiBody)};return {PublicProfileHeader,PublicProfileOverview,ProfileOwnerTools,ProfileIntroduction};`)(...Object.values(bindings));
const entries = [
  { id: '1', kitsuId: '1', title: 'Watching fixture', status: 'watching', totalEpisodes: 12, watchedEpisodes: 3, imageUrl: 'https://example.test/anime.jpg' },
  { id: 'v1', kitsuId: 'v1', title: 'Reading fixture', status: 'watching', watchedEpisodes: 5, imageUrl: 'https://example.test/vn.jpg' },
  { id: '2', kitsuId: '2', title: 'Dropped fixture', status: 'dropped' },
].map(profile.profileEntry);
const stats = { completed: 1, meanScore: '8.5', hours: 14, eps: 3, daysConsumed: '0.6' };
test('immersive profile has real library media, tabs and follow actions without nested overview cards', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PublicProfileHeader, { name: 'Friend', entries, stats, tab: 'overview', canFollow: true }));
  assert.match(html, /anime\.jpg/); assert.match(html, /vn\.jpg/); assert.match(html, /Statistics/); assert.match(html, /Library/); assert.match(html, /Follow/);
  const overview = renderToStaticMarkup(React.createElement(ui.PublicProfileOverview, { entries, stats }));
  assert.match(overview, /Watching fixture/); assert.match(overview, /Reading fixture/);
  assert.doesNotMatch(overview, /data-tile="Dropped fixture"/);
  assert.match(overview, /Open entire library/);
});
test('private profile header never renders library images or counts', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PublicProfileHeader, { name: 'Friend', entries, stats, privateLibrary: true }));
  assert.doesNotMatch(html, /<img|anime\.jpg|vn\.jpg|3 titles/);
  assert.match(html, /Private library/);
});
test('bio joins the identity header, respects module order and visibility, and keeps safe formatting', () => {
  const value = identity.defaultIdentity(); value.bio = '**Profile introduction** ||Hidden ending|| <script>bad</script>';
  const render = identity => renderToStaticMarkup(React.createElement(ui.PublicProfileHeader, { name: 'Friend', entries, stats, tab: 'overview', identity }));
  const html = render(value);
  assert.match(html, /public-profile-avatar/); assert.match(html, /public-profile-intro/);
  assert.match(html, /<strong>Profile introduction<\/strong>/); assert.doesNotMatch(html, /<script>|<details[^>]*open/);
  assert.ok(html.indexOf('Profile introduction') < html.indexOf('Overview'));
  assert.doesNotMatch(render({ ...value, modules: ['progress', 'bio'] }), /Profile introduction/);
  assert.doesNotMatch(render({ ...value, modules: ['progress'] }), /Profile introduction/);
  const long = render({ ...value, bio: 'Long introduction '.repeat(40) });
  assert.match(long, /aria-expanded="false"/); assert.match(long, /Read more/);
});
const walk = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)];
test('visitor view is a discreet icon action, with an explicit exit and no owner tools while previewing', () => {
  let toggled = 0;
  const props = { busy: false, onPreview: () => toggled++, onCustomize() {}, onAccount() {}, onLogout() {} };
  const tree = ui.ProfileOwnerTools({ ...props, preview: false });
  walk(tree).find(node => node.props['aria-label'] === 'View as visitor').props.onClick();
  assert.equal(toggled, 1);
  const html = renderToStaticMarkup(tree);
  assert.doesNotMatch(html, /type="checkbox"/); assert.match(html, /Customize profile/);
  const preview = ui.ProfileOwnerTools({ ...props, preview: true });
  const previewHtml = renderToStaticMarkup(preview);
  assert.match(previewHtml, /Viewing as a visitor/); assert.match(previewHtml, /Exit preview/);
  assert.doesNotMatch(previewHtml, /Customize profile|Manage account|Sign out/);
  walk(preview).find(node => node.type === 'button').props.onClick();
  assert.equal(toggled, 2);
});
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
function renderProfile(state, props = {}) {
  const names = component.body.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]).filter(n => ts.isArrayBindingPattern(n.name) && n.initializer?.expression?.getText(ast) === 'useState').map(n => n.name.elements[0].name.text);
  let index = 0;
  const values = { loadedTarget: { targetUid: 'friend', currentUserId: 'me', readOnly: false }, list: entries, loading: false, activityLoading: false, ...state };
  const bound = { React, ...profile, ...analytics, ...identity, ...ui, appId: 'test', IdentityShowcase: () => null, ProfileBio, useProfileIdentity: () => ({ identity: state.identity || identity.defaultIdentity(), revision: 0, loading: false, error: '' }), useState: initial => { const name = names[index++]; return [Object.hasOwn(values, name) ? values[name] : typeof initial === 'function' ? initial() : initial, () => {}]; }, useMemo: callback => callback(), useEffect() {}, useContext: () => ({ theme: {} }), ThemeContext: {},
    useFranchiseCatalogue: () => ({ catalogue: {}, state: { loading: false } }),
    AnalyticsDashboard: props => React.createElement('div', { 'data-public-statistics': props.title, 'data-editable': String(props.editableGroups) }),
    ActivityHeatmap: () => React.createElement('div'), groupEpisodeActivity: items => items, LockIcon: icons.Lock, SettingsIcon: icons.Settings, LogoutIcon: icons.LogOut,
    AnimeDetailsModal: props => React.createElement('div', { 'data-log-owner': props.ownerId, 'data-log-read-only': String(props.readOnly), 'data-shared-progress': props.sharedProgress?.username }),
  };
  const Page = new Function(...Object.keys(bound), `${compile(component.getText(ast).replace(/^export /, ''))};return UserProfilePage;`)(...Object.values(bound));
  return renderToStaticMarkup(React.createElement(Page, { db: {}, currentUserId: 'me', targetUser: { uid: 'friend', username: 'Friend' }, readOnly: false, ...props }));
}
test('account controls appear only on the signed-in owner profile', () => {
  const state = { loadedTarget: { targetUid: 'me', currentUserId: 'me', readOnly: false } };
  const props = { targetUser: { uid: 'me', username: 'Owner' }, onLogout() {} };
  assert.match(renderProfile(state, props), /Manage account/);
  assert.match(renderProfile(state, props), /aria-label="Sign out"/);
  assert.doesNotMatch(renderProfile({}, { onLogout() {} }), /Manage account|aria-label="Sign out"/);
  assert.doesNotMatch(renderProfile({ loadedTarget: { ...state.loadedTarget, readOnly: true } }, { ...props, readOnly: true }), /Manage account|aria-label="Sign out"/);
});
test('a member can track a title from another profile in their own log', () => {
  const state = { selectedAnimeData: entries[0], selectedOwnerId: 'friend' };
  assert.match(renderProfile(state), /data-log-owner="me" data-log-read-only="false" data-shared-progress="Friend"/);
  assert.match(renderProfile({ ...state, loadedTarget: { targetUid: 'friend', currentUserId: null, readOnly: true } }, { currentUserId: null, readOnly: true }), /data-log-owner="friend" data-log-read-only="true"/);
  assert.doesNotMatch(renderProfile({ ...state, libraryPrivate: true }), /data-log-owner/);
});
test('default bio renders exactly once and a deliberately reordered bio keeps its position', () => {
  const value = identity.defaultIdentity(); value.bio = 'Unique introduction fixture';
  const html = renderProfile({ identity: value });
  assert.equal(html.split(value.bio).length - 1, 1); assert.ok(html.indexOf(value.bio) < html.indexOf('Overview'));
  const moved = renderProfile({ identity: { ...value, modules: ['progress', 'bio'] } });
  assert.equal(moved.split(value.bio).length - 1, 1); assert.ok(moved.indexOf(value.bio) > moved.indexOf('In progress'));
});
test('public statistics uses target library, disables grouping writes, and respects privacy/error guards', () => {
  const html = renderProfile({ tab: 'stats' });
  assert.match(html, /data-public-statistics="Friend&#x27;s Statistics"/); assert.match(html, /data-editable="false"/);
  assert.doesNotMatch(renderProfile({ tab: 'stats', libraryPrivate: true }), /data-public-statistics/);
  assert.doesNotMatch(renderProfile({ tab: 'stats', loadError: 'Permission denied' }), /data-public-statistics/);
});
