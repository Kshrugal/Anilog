import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../services/vndb.ts', import.meta.url), 'utf8');
const identity = await readFile(new URL('../services/profile-identity.ts', import.meta.url), 'utf8');
const compile = code => ts.transpile(code.replace(/^import .*\n/gm, '').replace(/^export /gm, ''), { target: ts.ScriptTarget.ES2022 });
const requests = [];
const normalImage = { url: 'https://s.vndb.org/cv/10/1910.jpg', thumbnail: 'https://t.vndb.org/cv.t/10/1910.jpg', votecount: 7, sexual: 0, violence: 0 };
const novel = { id: 'v17', title: 'A visual novel', image: normalImage, length_minutes: 1800, length: 4, rating: 88.5,
  languages: ['en', 'ja'], platforms: ['win'], description: '[b]A story[/b] [spoiler]twist [spoiler]nested[/spoiler] another twist[/spoiler] continues.' };
let fail = false;
const api = vm.runInNewContext(compile(identity) + compile(source) + '\n({vnBrowseRequest, VN_FILTER_DEFAULTS, vnSynopsis, vnCover, mapVnRecord, browseVns, fetchVnDetails});', {
  AbortSignal, URL,
  fetch: async (url, { body, signal }) => {
    assert.equal(url, 'https://api.vndb.org/kana/vn');
    assert.ok(signal);
    const request = JSON.parse(body);
    requests.push(request);
    return fail ? { ok: false, status: 429 } : { ok: true, json: async () => ({ more: request.page === 1, results: [novel] }) };
  },
});
const filter = { ...api.VN_FILTER_DEFAULTS, mood: 'g19', language: 'en', platform: 'swi', length: '2' };
const body = JSON.parse(JSON.stringify(api.vnBrowseRequest('  title  ', filter, 2, '2026-11-21')));
assert.deepEqual(body.filters, ['and', ['search', '=', 'title'], ['tag', '=', ['g19', 0, 1]], ['length', '=', 2],
  ['release', '=', ['and', ['lang', '=', 'en'], ['platform', '=', 'swi'], ['rtype', '=', 'complete'], ['released', '<=', '2026-11-21']]]]);
assert.equal(body.sort, 'searchrank');
assert.equal(body.reverse, false);
assert.equal(body.page, 2);
assert.doesNotMatch(body.fields, /description|tags/);
const newest = api.vnBrowseRequest('', { ...api.VN_FILTER_DEFAULTS, sort: 'newest' }, 1, '2026-11-21');
assert.equal(newest.reverse, true);
assert.equal(newest.filters[0], 'released');
assert.equal(api.vnSynopsis('[SPOILER]end revealed'), '');
assert.equal(api.mapVnRecord(novel).synopsis, 'A story  continues.');
assert.equal(api.mapVnRecord({ ...novel, image: { ...normalImage, sexual: 1.2 } }).imageUrl, '');
assert.equal(api.vnCover({ ...normalImage, violence: 1 }), '');
assert.equal(api.vnCover({ ...normalImage, votecount: 0 }), '');
assert.equal(api.vnCover({ ...normalImage, url: 'https://example.invalid/cover.jpg' }), '');
assert.equal(api.vnCover(normalImage, true), normalImage.thumbnail);
const signal = new AbortController().signal;
assert.equal((await api.browseVns('', filter, 1, signal)).more, true);
await api.browseVns('', filter, 1, signal);
assert.equal(requests.length, 1, 'the same completed request is reused');
assert.equal((await api.browseVns('', filter, 2, signal)).more, false);
assert.equal(requests.at(-1).page, 2);
fail = true;
await assert.rejects(api.browseVns('other', filter, 1, signal), /VNDB is busy/);
fail = false;
await api.browseVns('other', filter, 1, signal);
await assert.rejects(api.browseVns('aborted', filter, 1, AbortSignal.abort()), /aborted/i);
const detail = await api.fetchVnDetails('v17');
assert.equal(detail.attributes.episodeCount, 0);
assert.equal(detail.attributes.estimatedLengthMinutes, 1800);
assert.equal(detail.attributes.averageRating, 88.5);
assert.match(requests.at(-1).fields, /description/);
assert.deepEqual(Array.from(requests.at(-1).filters), ['id', '=', 'v17']);
await assert.rejects(api.fetchVnDetails('v17/invalid'), /Invalid VNDB title ID/);
console.log('VNDB catalogue filters, release matching, browser cover policy, spoiler redaction, paging, cache and details passed.');
