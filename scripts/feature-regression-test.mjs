import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, pages, rules] = await Promise.all([
  readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../features/Pages.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(app, /ScrambleText/, 'carousel headings must never use the unreliable scramble animation');
assert.match(app, /NotificationCenter/, 'the header notification control must open a real inbox');
assert.match(pages, /Select multiple/, 'the library must retain bulk-selection controls');
assert.match(pages, /anilog_saved_views_/, 'saved library views must be persisted');
assert.match(pages, /vnPlaytimeHours/, 'VN playtime tracking must be retained');
assert.match(pages, /vnEndingsCompleted/, 'VN ending tracking must be retained');
assert.match(pages, /Contains spoilers/, 'social spoiler controls must be retained');
assert.match(pages, /SocialActions/, 'social reactions and replies must be retained');
assert.match(pages, /Review .* existing/, 'AniList import conflicts must remain visible before import');
assert.match(rules, /libraryPublic.*== true/, 'private-library reads must be enforced by Firestore');
assert.match(rules, /match \/interactions\//, 'social interaction ownership rules must be deployed with the feature');

console.log('Feature regression checks passed.');
