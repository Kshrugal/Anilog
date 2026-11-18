import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../services/community-activity.ts', import.meta.url), 'utf8');
const code = ts.transpile(source.replace(/^import .*\n/m, '').replace(/^export /gm, ''), { target: ts.ScriptTarget.ES2022 });
const listeners = [];
const service = runInNewContext(code + '\n({ followedIds, subscribeCommunityActivity });', {
  collection: (_db, path) => path, doc: (_db, path) => path, limit: count => ({ count }), orderBy: (...order) => ({ order }),
  where: (...filter) => ({ filter }), query: (...args) => args,
  onSnapshot: (request, ...args) => {
    const [callback, fail] = args.slice(-2);
    const listener = { request, callback, fail, stopped: false };
    listeners.push(listener);
    return () => { listener.stopped = true; };
  },
});
assert.deepEqual(Array.from(service.followedIds(['a', { uid: 'b' }, 'a', null, { uid: 'invalid/path' }])), ['a', 'b']);
const published = [];
const stop = service.subscribeCommunityActivity({}, 'demo', 'me', ['me', 'friend'], 2, items => published.push(items), assert.fail);
assert.equal(listeners.length, 2);
assert.equal(listeners[0].request[1].filter[2], 'me');
listeners[1].callback({ data: () => ({ friends: [] }) });
assert.equal(listeners.length, 2);
listeners[1].callback({ data: () => ({ friends: ['me'] }) });
assert.equal(listeners[2].request[2].filter[0], 'sharedBy');
const snapshot = (id, seconds, nanoseconds) => ({ id, data: () => ({ timestamp: { seconds, nanoseconds } }) });
listeners[2].callback({ metadata: { fromCache: true }, docs: [snapshot('newest', 5, 9)] });
assert.equal(published.at(-1).length, 0);
listeners[2].callback({ metadata: { fromCache: false }, docs: [snapshot('newest', 5, 9)] });
listeners[0].callback({ docs: [snapshot('middle', 5, 5), snapshot('old', 4, 0)] });
assert.deepEqual(Array.from(published.at(-1), item => item.id), ['newest', 'middle']);
listeners[1].callback({ data: () => ({ friends: [] }) });
assert.deepEqual(Array.from(published.at(-1), item => item.id), ['middle', 'old']);
stop();
assert.ok(listeners.every(listener => listener.stopped));
service.subscribeCommunityActivity({}, 'demo', '', [], 2, items => assert.equal(items.length, 0), assert.fail);
assert.equal(listeners.length, 3);
console.log('Community activity scope, merge order, empty state, and cleanup passed.');
