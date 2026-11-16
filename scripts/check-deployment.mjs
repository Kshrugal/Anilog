import { setTimeout as delay } from 'node:timers/promises';

const base = process.argv[2];
if (!base || !URL.canParse(base)) throw new Error('Provide the deployed service URL.');
const url = new URL(base);
if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1') throw new Error('Use an HTTPS deployment URL.');

let failure;
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    for (const path of ['/', '/search', '/schedule']) {
      const response = await fetch(new URL(path, url), { signal: AbortSignal.timeout(10_000) });
      const html = await response.text();
      if (!response.ok || !html.includes('<div id="root"></div>')) {
        throw new Error(`${path} did not serve AniLog (HTTP ${response.status}). Check Cloud Run logs, including project billing.`);
      }
    }
    console.log('Deployed AniLog routes are responding successfully.');
    process.exit(0);
  } catch (error) {
    failure = error;
    console.error(`Health check ${attempt}/6: ${error.message}`);
    if (attempt < 6) await delay(5_000);
  }
}
throw failure;
