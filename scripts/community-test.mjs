import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../services/community-activity.ts', import.meta.url), 'utf8');
const code = ts.transpile(source.replace(/^import .*\n/m, '').replace(/^export /gm, ''), { target: ts.ScriptTarget.ES2022 });
const listeners = [];
const service = runInNewContext(code + '\n({ followedIds, groupEpisodeActivity, subscribeCommunityActivity });', {
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

const progress = (id, episode, seconds, overrides = {}) => ({
  id, userId: 'me', animeKitsuId: 'anilist:20', type: 'progress',
  context: `watched episode ${episode} of`, timestamp: { seconds }, ...overrides,
});
const episodeOne = progress('one', 1, 100, { context: 'watched ep 1' });
const otherTitle = progress('other', 2, 200, { animeKitsuId: 'anilist:21' });
const otherUser = progress('friend', 2, 300, { userId: 'friend' });
const vnProgress = progress('vn', 20, 400, { context: 'read 20% of' });
const two = progress('two', 2, 86500); // Exactly 24 hours later.
const three = progress('three', 3, 86600);
const four = progress('four', 4, 173001); // 24 hours and one second later.
const six = progress('six', 6, 173100);
const repeat = progress('repeat', 1, 173200);
const grouped = service.groupEpisodeActivity([three, four, vnProgress, repeat, otherUser, six, two, episodeOne, otherTitle]);
assert.deepEqual(Array.from(grouped, item => item.id), ['repeat', 'six', 'four', 'one', 'vn', 'friend', 'other']);
assert.equal(grouped[3].context, 'watched episodes 1–3 of');
assert.equal(grouped[3].timestamp.seconds, three.timestamp.seconds);
assert.deepEqual(Array.from(grouped[3].episodes, episode => episode.id), ['one', 'two', 'three']);
assert.equal(episodeOne.context, 'watched ep 1');
assert.equal(service.groupEpisodeActivity([episodeOne, { ...two, sharedBy: 'me' }]).length, 2);
assert.equal(service.groupEpisodeActivity([episodeOne, { ...two, timestamp: null }]).length, 2);
console.log('Episode sessions preserve order and threads across titles, audiences, and time gaps.');

const searchSource = await readFile(new URL('../services/people-search.ts', import.meta.url), 'utf8');
const searchCode = ts.transpile(searchSource.replace(/^import .*\n/m, '').replace(/^export /gm, ''), { target: ts.ScriptTarget.ES2022 });
const person = (id, username, usernameSearch) => ({ id, data: () => ({ username, usernameSearch }) });
let legacyReads = 0;
const directory = runInNewContext(searchCode + '\n({ searchPeople, isUsernameTaken });', {
  collection: () => 'users', limit: count => ({ count }), where: (...predicate) => ({ predicate }), query: (...args) => args,
  getDocsFromServer: async args => {
    if (args[1].count === 100) {
      legacyReads++;
      return { docs: [person('legacy', 'RaNdom'), person('self', 'RaVEn'), person('else', 'Else')] };
    }
    return { docs: args[1].predicate[1] === '==' ? [] : [person('indexed', 'Ramen', 'ramen')] };
  },
});
const client = {};
assert.deepEqual(Array.from(await directory.searchPeople(client, 'demo', 'self', ' RA '), item => item.uid), ['indexed', 'legacy']);
assert.deepEqual(Array.from(await directory.searchPeople(client, 'demo', 'self', 'ra'), item => item.uid), ['indexed', 'legacy']);
assert.equal(await directory.isUsernameTaken(client, 'demo', 'RANDOM'), true);
assert.equal(await directory.isUsernameTaken(client, 'demo', 'RANDOM', 'legacy'), false);
assert.equal(legacyReads, 1, 'typing and duplicate checks reuse the bounded legacy lookup');
console.log('Case-insensitive people suggestions and legacy lookup cache passed.');

const tsSource = async name => ts.transpile(
  (await readFile(new URL(`../services/${name}.ts`, import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace(/^export /gm, ''),
  { target: ts.ScriptTarget.ES2022 },
);
const fetched = [];
const mediaId = 'anilist:20';
const pathValue = path => {
  fetched.push(path);
  const [, uid, subcollection] = path.split('/users/');
  if (subcollection) assert.fail('Unexpected path');
  if (uid === 'me') return { followingIds: ['friend', 'blocked', 'one-way'] };
  if (uid === 'friend') return { username: 'Friend', followingIds: ['me'] };
  if (uid === 'one-way') return { username: 'One Way', followingIds: [] };
  if (uid === `blocked/publicLibrary/${mediaId}`) throw new Error('permission-denied');
  if (uid === `friend/publicLibrary/${mediaId}`) return { kitsuId: mediaId, status: 'watching', watchedEpisodes: 6, totalEpisodes: 13 };
  if (uid === `one-way/publicLibrary/${mediaId}`) return { kitsuId: mediaId, status: 'completed', score: 10 };
  assert.fail(path);
};
const detail = runInNewContext(await tsSource('profile') + await tsSource('media-following') + '\n({ loadMediaFollowing, followingRow, mediaFollowingId });', {
  followedIds: service.followedIds,
  doc: (_db, path) => path, collection: (_db, path) => path, query: (...args) => args, where: (...args) => args, limit: count => count,
  getDocFromServer: async path => ({ data: () => pathValue(path) }),
  getDocsFromServer: async ([, ...constraints]) => {
    assert.deepEqual(constraints.map(value => Array.isArray(value) ? [...value] : value), [
      ['userId', '==', 'friend'], ['sharedBy', '==', 'friend'], ['type', '==', 'micro_review'], ['animeKitsuId', '==', mediaId], 12,
    ]);
    return { docs: [{ data: () => ({ animeKitsuId: mediaId, context: 'reviewed 9/10', noteContent: 'Spoiler', spoiler: true }) }] };
  },
});
assert.equal(detail.mediaFollowingId({ provider: 'vndb', id: 20 }), 'v20');
assert.equal(detail.mediaFollowingId({ provider: 'anilist', id: 20 }), mediaId);
assert.equal(detail.mediaFollowingId({ id: 20 }), '20');
assert.equal(detail.mediaFollowingId({ id: 'invalid/path' }), '');
const controller = new AbortController();
const detailRows = await detail.loadMediaFollowing({}, 'demo', 'me', mediaId, controller.signal);
assert.deepEqual(Array.from(detailRows, row => row.uid), ['friend', 'one-way']);
assert.equal(detailRows[0].progress, 'Episode 6 of 13');
assert.equal(detailRows[0].review.spoiler, true);
assert.equal(detailRows[0].score, 9);
assert.ok(fetched.every(path => !path.includes('/animeList/') && !path.endsWith('/blocked')));
const vn = detail.followingRow('friend', 'Friend', { kitsuId: 'v20', status: 'reading', watchedEpisodes: 85, vnRoute: 'Secret' }, null, 'v20');
assert.equal(vn.status, 'Reading');
assert.equal(vn.progress, '85% read');
assert.ok(!JSON.stringify(vn).includes('Secret'));
controller.abort();
assert.equal((await detail.loadMediaFollowing({}, 'demo', 'me', mediaId, controller.signal)).length, 0);
console.log('Exact-title following rows, permission failures, spoiler reviews, and VN progress passed.');
