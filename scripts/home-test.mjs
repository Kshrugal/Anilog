import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motion } from 'framer-motion';
import * as icons from 'lucide-react';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const profileSource = await readFile(new URL('../services/profile.ts', import.meta.url), 'utf8');
const profile = await import(url(profileSource));
const tracking = await readFile(new URL('../services/tracking.ts', import.meta.url), 'utf8');
const source = (await readFile(new URL('../services/home-library.ts', import.meta.url), 'utf8')).replace("from './profile'", `from '${url(profileSource)}'`).replace("from './tracking'", `from '${url(tracking)}'`);
const home = await import(url(source));
const entries = [
  { id: '1', title: 'Anime', status: 'watching', watchedEpisodes: 3, totalEpisodes: 12, updatedAt: 100 },
  { id: 'v1', title: 'Novel', status: 'reading', watchedEpisodes: 98, updatedAt: { seconds: 1 } },
  { id: '2', title: 'Finished', status: 'completed', watchedEpisodes: 12, totalEpisodes: 12 },
  { id: 'v2', title: 'Finished novel', status: 'watching', watchedEpisodes: 100 },
  { id: '3', title: 'Unknown length', status: 'watching', watchedEpisodes: 13, updatedAt: 50 },
  { id: '4', title: 'Backlog', status: 'planning' },
];
test('resume queue handles both media, legacy reading states, completion limits and stable recency', () => {
  assert.deepEqual(home.resumeQueue(entries).map(entry => entry.id), ['v1', '1', '3']);
  assert.deepEqual(home.resumeQueue(entries, 'vn').map(entry => entry.id), ['v1']);
  assert.deepEqual(home.resumeQueue(entries, 'anime').map(entry => entry.id), ['1', '3']);
  assert.deepEqual(home.resumeQueue([]), []);
  assert.equal(home.resumeQueue(entries)[0].mediaType, 'vn');
  assert.equal(entries[1].mediaType, undefined, 'normalization must not mutate saved records');
});
test('status counts are individual library records, and labels reflect the media filter', () => {
  assert.deepEqual(home.libraryStatusCounts(entries), { all: 6, watching: 4, completed: 1, planned: 1, paused: 0, dropped: 0 });
  assert.equal(home.libraryStatusCounts(entries, 'vn').all, 2);
  assert.equal(home.homeStatusLabel('watching'), 'In progress');
  assert.equal(home.homeStatusLabel('watching', 'anime'), 'Watching');
  assert.equal(home.homeStatusLabel('watching', 'vn'), 'Reading');
});
test('progress commands accurately describe recording, including the final VN percentage', () => {
  assert.equal(home.progressCommand(entries[0]), 'Log episode 4');
  assert.equal(home.progressCommand(profile.profileEntry(entries[1])), 'Log 2% read');
  assert.equal(home.progressCommand(entries[1]), 'Log 2% read');
  assert.equal(home.progressCommand(profile.profileEntry(entries[3])), null);
});
test('saved views reject invalid storage shapes and never retain arbitrary fields', () => {
  const config = { statusFilter: 'all', mediaFilter: 'vn', collectionFilter: 'favorites', tagFilter: 'weekend', sortBy: 'score', viewMode: 'journal' };
  for (const input of [null, {}, 'invalid']) assert.deepEqual(home.normalizeSavedViews(input), []);
  const result = home.normalizeSavedViews([{ id: 1, name: 'Valid', private: 'ignored', config: { ...config, extra: 'ignored' } }, { id: 2, name: 'Invalid', config: { ...config, viewMode: 'unknown' } }]);
  assert.equal(result.length, 1); assert.equal(result[0].private, undefined); assert.equal(result[0].config.extra, undefined);
  assert.equal(home.normalizeSavedViews(Array.from({ length: 8 }, (_, id) => ({ id, name: 'View', config }))).length, 5);
});

const uiSource = await readFile(new URL('../features/HomeResume.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('HomeResume.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const body = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast).replace(/^export /, '')).join('\n');
const bindings = { React, motion, ...Object.fromEntries(['BookOpen', 'Check', 'ChevronDown', 'Loader2', 'Tv'].map(name => [name, icons[name]])), ...profile, ...home };
const { HomeResume } = new Function(...Object.keys(bindings), `${compile(body)};return {HomeResume};`)(...Object.values(bindings));
const walk = node => React.isValidElement(node) ? [node, ...React.Children.toArray(node.props.children).flatMap(walk)] : [];
test('resume selection and opening never record progress; logging is a separate command', () => {
  const queue = home.resumeQueue(entries), calls = [];
  const props = { entries: queue, selected: queue[0], theme: {}, pending: false, onOpen: entry => calls.push(['open', entry.id]), onSelect: id => calls.push(['select', id]), onIncrement: entry => calls.push(['log', entry.id]) };
  const controls = walk(HomeResume(props));
  controls.find(node => node.type === 'select').props.onChange({ target: { value: '1' } });
  controls.find(node => node.type === 'button' && node.props.title === `Open ${queue[0].title}`).props.onClick();
  assert.deepEqual(calls, [['select', '1'], ['open', 'v1']]);
  controls.find(node => node.props.className === 'home-log-progress').props.onClick();
  assert.deepEqual(calls.at(-1), ['log', 'v1']);
  const html = renderToStaticMarkup(React.createElement(HomeResume, { ...props, pending: true }));
  assert.match(html, /disabled=""/); assert.match(html, /Saving/); assert.doesNotMatch(html, /Watch Next|Read Next/);
  const unknown = walk(HomeResume({ ...props, selected: queue.find(entry => entry.id === '3') })).find(node => node.props.role === 'progressbar');
  assert.equal(unknown.props['aria-valuenow'], undefined); assert.equal(unknown.props['aria-valuemax'], undefined);
});

test('outgoing library grids remain animated but cannot receive input or screen-reader focus', async () => {
  const source = await readFile(new URL('../features/LibraryGrid.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('LibraryGrid.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const body = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast).replace(/^export /, '')).join('\n');
  const motion = { div: React.forwardRef(function TestDiv(props, ref) { return React.createElement('div', { ref, inert: props.inert, 'aria-hidden': props['aria-hidden'], style: props.style }, props.children); }) };
  for (const present of [false, true]) {
    const { LibraryGrid } = new Function('React', 'motion', 'useIsPresent', `${compile(body)};return {LibraryGrid};`)(React, motion, () => present);
    const html = renderToStaticMarkup(React.createElement(LibraryGrid, { className: 'grid', variants: {} }, 'Library'));
    assert.equal(html.includes('inert=""'), !present); assert.equal(html.includes('aria-hidden="true"'), !present); assert.equal(html.includes('pointer-events:none'), !present);
  }
});
