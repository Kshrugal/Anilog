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
    assert.match(html, /<div id="root"><\/div>/);
    assert.match(html, /<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>/);
  }

  console.log('Production smoke test passed.');
} finally {
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
