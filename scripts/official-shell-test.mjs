import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import React from 'react';
import ts from 'typescript';

const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(tree.parseDiagnostics.length, 0);
const printer = ts.createPrinter({ removeComments: true });
const declaration = name => {
  const node = tree.statements.find(node => (ts.isFunctionDeclaration(node) && node.name?.text === name)
    || (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(tree) === name)));
  assert.ok(node, `Missing declaration: ${name}`);
  return node;
};
const text = name => declaration(name).getText(tree);

// Canonical printed visual nodes only: no Git history, environment, or Firebase fixtures.
const visualFingerprints = {
  StarField: '3504e0047945fedea195272e0ce021957b547d24d1f61790b3c8d8e2922173b9',
  MouseTrail: '265ef768e34795af096ef0c19ea7f5af19c7936eae9cf15f623fd5d5cd56de8b',
  AnimeCarousel: '1db6955711ae556e7fd8aab5f2ab5a787900ea90e0fa93bedce34bc237217c72',
};
for (const [name, expected] of Object.entries(visualFingerprints)) {
  const printed = printer.printNode(ts.EmitHint.Unspecified, declaration(name), tree).replace(/\s+$/gm, '');
  assert.equal(createHash('sha256').update(printed).digest('hex'), expected, `${name}: official visual contract changed`);
}

assert.doesNotMatch(source, /ScrambleText|>AL<|<aside className=\{`sticky/);
assert.doesNotMatch(source, /Made by|Support the Dev|paypal\.me|FooterInfo/);
const card = text('AnimeCard');
for (const effect of ['onMouseMove={handleMouseMove}', 'onMouseLeave={handleMouseLeave}', 'style={{ rotateX, rotateY', 'background: sheenGradient', 'group-hover:scale-110']) {
  assert.ok(card.includes(effect), `Live card effect: ${effect}`);
}
assert.match(card, /toLocaleDateString\('en-US', \{ weekday: 'short' \}\)/);
assert.doesNotMatch(card, /idNum|% 7/);
for (const field of ['favorite', 'priority', 'personalTags', 'onQuickIncrement']) assert.ok(card.includes(field));

const app = text('App');
assert.match(app, /guestMode \? \['search', 'discovery', 'social'\] : \['home', 'search', 'discovery', 'social', 'stats'\]/);
assert.match(app, /navItem === 'stats' && <StatsIcon/);
assert.match(app, /onClick=\{\(\) => setPage\(navItem\)\}/);
assert.match(app, /<MouseTrail themeId=\{themeId\} active=\{showTrail\}/);
assert.match(app, /setShowTrail, setPage, sidebarCollapsed, setSidebarCollapsed, density, setDensity, showQuickTip, setShowQuickTip/);
assert.match(app, /flex-grow min-w-0 w-full container mx-auto p-4 pb-32 z-10/);
assert.match(app, /case "schedule": return <SchedulePage/);
assert.match(app, /case "decks": return <DecksPage/);
assert.match(app, /viewTargetUser.uid === targetProfileUid/);
assert.match(app, /decodeURIComponent\(location.pathname.slice\('\/users\/'\.length\)\)/);
assert.match(app, /return \(\) => \{ active = false; \}/);
assert.match(app, /const isCurrent = \(\) => active && version === authVersion/);
assert.match(app, /active = false;\s+unsubscribe\(\)/);
assert.doesNotMatch(app, /signInAnonymously/);
assert.match(app, /!guestMode && \(!currentUser \|\| currentUser.isAnonymous\)/);
assert.match(app, /if \(!db && \['social', 'decks', 'user_profile'\].includes\(page\)\)/);
for (const page of ['SearchPage', 'SocialPage', 'SchedulePage', 'DecksPage']) {
  assert.match(app, new RegExp('<' + page + '[^>]+readOnly=\\{guestMode\\}'));
}
assert.match(app, /isNotificationsOpen && !guestMode && <NotificationCenter/);
for (const action of ["setPage('schedule')", "setPage('decks')"]) assert.ok(text('CommandPalette').includes(action));
assert.match(text('NotificationCenter'), /onSnapshot\(query\(collection/);
assert.match(text('fetchMediaDetails'), /AbortSignal.timeout\(15_000\)/);
assert.match(text('exportUserData'), /URL.revokeObjectURL\(url\)/);

const headerTools = text('HeaderTools');
for (const label of ['Schedule', 'Decks', 'Notifications']) assert.ok(headerTools.includes(`label: '${label}'`));
assert.match(headerTools, /!guestMode \? \[\{ label: 'Notifications'/);
assert.match(headerTools, /hidden items-center space-x-2 sm:flex/);
assert.match(headerTools, /relative sm:hidden/);
assert.match(headerTools, /aria-expanded=\{isOpen\}/);
assert.match(headerTools, /event.key === 'Escape'/);
assert.match(headerTools, /setIsOpen\(false\); triggerRef.current\?\.focus\(\); action\(\)/);
assert.match(headerTools, /menuRef.current\?\.contains\(event.target\)/);
assert.match(headerTools, /removeEventListener\('keydown', onKeyDown\)/);
assert.match(headerTools, /removeEventListener\('pointerdown', onPointerDown\)/);
assert.doesNotMatch(app, /title="Stats"/, 'Stats remains in the dock without a duplicate header button');
assert.match(app, /openUserProfile\(\{ uid: userId, username \}\)/);
assert.match(app, /title="Profile"/);
assert.match(app, /title="Sign in"/);
assert.doesNotMatch(app, /title="Logout"/, 'sign out belongs to owner account controls');
// Exercise the actual menu handlers without Firebase or a browser dependency.
let open = false;
let refIndex = 0;
let focused = 0;
let cleanup;
const refs = [{ current: { contains: target => target === 'inside' } }, { current: { focus: () => focused++ } }];
const listeners = new Map();
const calls = [];
const compiled = ts.transpile(text('HeaderTools') + '\nHeaderTools;', { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 });
const component = runInNewContext(compiled, {
  React, motion: { button: 'button' },
  ScheduleIcon: 'schedule-icon', DecksIcon: 'decks-icon', SearchIcon: 'search-icon', BellIcon: 'bell-icon', MenuIcon: 'menu-icon',
  useState: () => [open, value => { open = typeof value === 'function' ? value(open) : value; }],
  useRef: () => refs[refIndex++],
  useEffect: effect => { cleanup?.(); cleanup = effect(); },
  document: {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); },
  },
});
const render = (guestMode = false) => {
  refIndex = 0;
  return component({ guestMode, setPage: page => calls.push(page), onCommands: () => calls.push('commands'), onNotifications: () => calls.push('notifications') });
};
const find = (element, predicate) => {
  if (!React.isValidElement(element)) return [];
  return [...(predicate(element) ? [element] : []), ...React.Children.toArray(element.props.children).flatMap(child => find(child, predicate))];
};
const mobileMenu = () => find(render(), element => element.props.id === 'header-tools-menu')[0];
const trigger = find(render(), element => element.props['aria-label'] === 'More tools')[0];
trigger.props.onClick();
assert.equal(open, true);
for (const [index, expected] of ['schedule', 'decks', 'notifications'].entries()) {
  open = true;
  const actions = find(mobileMenu(), element => element.type === 'button');
  assert.equal(actions.length, 3);
  actions[index].props.onClick();
  assert.equal(open, false, 'menu closes after an action');
  assert.equal(calls.at(-1), expected);
}
open = true;
render();
listeners.get('keydown')({ key: 'Escape' });
assert.equal(open, false);
assert.ok(focused > 0, 'focus returns to the trigger');
open = true;
render();
listeners.get('pointerdown')({ target: 'inside' });
assert.equal(open, true);
listeners.get('pointerdown')({ target: 'outside' });
assert.equal(open, false);
open = true;
const guestMenu = find(render(true), element => element.props.id === 'header-tools-menu')[0];
assert.equal(find(guestMenu, element => element.type === 'button').length, 2, 'guests cannot access notifications');
cleanup?.();
assert.equal(listeners.size, 0, 'menu listeners are cleaned up');
console.log('Official shell, mobile menu, and preview safety contracts passed (no Git history required).');
