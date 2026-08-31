import assert from 'node:assert/strict';
import { preview } from 'vite';

const host = '127.0.0.1';
const port = 4173;
const server = await preview({
  preview: { host, port, strictPort: true },
  logLevel: 'silent',
});

try {
  for (const path of ['/', '/search', '/discover', '/social', '/stats', '/profile', '/users/smoke-test-user']) {
    const response = await fetch(`http://${host}:${port}${path}`);
    const html = await response.text();

    assert.equal(response.status, 200, `${path} should return HTTP 200`);
    assert.match(html, /<title>AniLog - Track & Discover Anime<\/title>/);
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/anilog-mark\.svg" \/>/);
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
    assert.doesNotMatch(html, /vite\.svg|kitsu\.io\/images\/default_cover/);
    assert.match(html, /<div id="root"><\/div>/);
    assert.match(html, /<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>/);
  }

  for (const asset of ['/anilog-mark.svg', '/anilog-social.svg', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml']) {
    const response = await fetch(`http://${host}:${port}${asset}`);
    assert.equal(response.status, 200, `${asset} should return HTTP 200`);
    assert.ok((await response.text()).length > 20, `${asset} should not be empty`);
  }

  console.log('Production smoke test passed.');
} finally {
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
