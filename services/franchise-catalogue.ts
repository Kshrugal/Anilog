import { mediaKey, type Catalogue, type CatalogueNode } from './franchises';

const CACHE_KEY = 'anilog:public-franchise-catalogue:v1';
const TTL = 7 * 24 * 60 * 60_000;
const nodes: Catalogue = {};
let restored = false;
let queue = Promise.resolve();
const jobs = new Map<string, Promise<Catalogue>>();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const fields = 'id type idMal title { romaji english native } synonyms startDate { year }';
const publicFields = `${fields} staff(perPage: 25) { edges { role node { id name { full } } } } relations { edges { relationType(version: 3) node { ${fields} } } }`;

function restore() {
  if (restored) return;
  restored = true;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    for (const [key, node] of Object.entries(cached)) if (node && typeof node === 'object' && (node as CatalogueNode).key === key && typeof (node as CatalogueNode).title === 'string' && Date.now() - ((node as CatalogueNode).fetchedAt || (node as CatalogueNode).cachedAt || 0) < TTL) nodes[key] = node as CatalogueNode;
  } catch { /* Public metadata caching is optional. */ }
}
function persist() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(Object.entries(nodes).sort((a, b) => (b[1].fetchedAt || 0) - (a[1].fetchedAt || 0)).slice(0, 2000)))); } catch { /* Storage can be full or disabled. */ }
}
export function cachedCatalogue(): Catalogue { restore(); return { ...nodes }; }

async function json(url: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    if (response.status === 429) throw new Error('Catalogue rate limit reached. Cached grouping is still available; try again later.');
    if (!response.ok) throw new Error(`Catalogue unavailable (${response.status}).`);
    const data = await response.json();
    if (data.errors?.length) throw new Error('Catalogue relationships could not be loaded.');
    return data;
  } finally { clearTimeout(timeout); }
}

function aniNode(media: any, full = false): CatalogueNode {
  return { key: `anilist:${media.id}`, type: media.type, title: media.title?.english || media.title?.romaji || media.title?.native || `Media ${media.id}`, titles: [...Object.values(media.title || {}), ...(media.synonyms || [])].filter((v): v is string => typeof v === 'string'), aliases: media.idMal ? [`mal:${media.type === 'MANGA' ? 'manga:' : ''}${media.idMal}`] : [], year: media.startDate?.year || 0, cachedAt: Date.now(),
    ...(full ? { fetchedAt: Date.now(), creators: (media.staff?.edges || []).filter((e: any) => /^(original (creator|story)|author|story(?:\s*&\s*art)?|scenario)$/i.test(e.role)).map((e: any) => ({ id: String(e.node.id), name: e.node.name.full, role: e.role })), relations: (media.relations?.edges || []).map((e: any) => ({ key: `anilist:${e.node.id}`, type: e.relationType })) } : {}) };
}
async function aniBatch(ids: number[], malIds: number[] = []) {
  const data = await json('https://graphql.anilist.co', { query: `query(${malIds.length ? '$mal:[Int]' : '$ids:[Int]'}) { Page(perPage:50) { media(${malIds.length ? 'idMal_in:$mal' : 'id_in:$ids'}, isAdult:false) { ${publicFields} } } }`, variables: malIds.length ? { mal: malIds } : { ids } });
  const media = data.data?.Page?.media || [];
  for (const item of media) {
    for (const edge of item.relations?.edges || []) if (!nodes[`anilist:${edge.node.id}`]) nodes[`anilist:${edge.node.id}`] = aniNode(edge.node);
    const node = aniNode(item, true);
    const existing = nodes[node.key];
    nodes[node.key] = { ...node, aliases: [...new Set([...(node.aliases || []), ...(existing?.aliases || [])])] };
  }
  return media.map((m: any) => `anilist:${m.id}`);
}
async function vnBatch(ids: string[]) {
  const data = await json('https://api.vndb.org/kana/vn', { filters: ids.length === 1 ? ['id', '=', ids[0]] : ['or', ...ids.map(id => ['id', '=', id])], fields: 'title,alttitle,aliases,developers.id,developers.name,staff.id,staff.name,staff.role,relations.id,relations.title,relations.relation,relations.relation_official', results: 100 });
  for (const item of data.results || []) {
    for (const relation of item.relations || []) if (!nodes[relation.id]) nodes[relation.id] = { key: relation.id, title: relation.title, cachedAt: Date.now() };
    nodes[item.id] = { key: item.id, title: item.title, titles: [item.alttitle, ...(item.aliases || [])].filter(Boolean), fetchedAt: Date.now(), developers: item.developers, creators: item.staff?.filter((s: any) => s.role === 'scenario').map((s: any) => ({ id: s.id, name: s.name, role: s.role })), relations: item.relations?.map((r: any) => ({ key: r.id, type: r.relation, official: r.relation_official })) };
  }
}

export async function loadFranchiseCatalogue(entries: Record<string, any>[], onProgress?: (value: { done: number; total: number }) => void): Promise<Catalogue> {
  restore();
  const keys = [...new Set(entries.map(mediaKey))].sort();
  const jobKey = keys.join('|');
  if (jobs.has(jobKey)) return jobs.get(jobKey);
  const work = async () => {
    const fresh = (key: string) => nodes[key]?.fetchedAt && Date.now() - nodes[key].fetchedAt < TTL;
    const find = (key: string) => nodes[key] || Object.values(nodes).find(n => n.aliases?.includes(key));
    const needed = keys.filter(key => !fresh(find(key)?.key || key));
    let done = keys.length - needed.length;
    const total = keys.length;
    onProgress?.({ done, total });
    const report = (count: number) => { done += count; onProgress?.({ done: Math.min(done, total), total }); };
    const aniIds = needed.filter(k => /^anilist:\d+$/.test(k)).map(k => Number(k.slice(8)));
    const vnIds = needed.filter(k => /^v\d+$/.test(k));
    // Exact Kitsu mappings only. No fuzzy title search silently chooses an identity.
    for (const key of needed.filter(k => /^kitsu:\d+$/.test(k)).slice(0, 100)) {
      const data = await json(`https://kitsu.io/api/edge/anime/${key.slice(6)}/mappings?page%5Blimit%5D=20`);
      const mapping = data.data?.find((m: any) => m.attributes?.externalSite === 'anilist/anime') || data.data?.find((m: any) => m.attributes?.externalSite === 'myanimelist/anime');
      if (mapping && /^\d+$/.test(String(mapping.attributes.externalId))) {
        const numeric = Number(mapping.attributes.externalId);
        const result = await aniBatch(mapping.attributes.externalSite === 'anilist/anime' ? [numeric] : [], mapping.attributes.externalSite === 'myanimelist/anime' ? [numeric] : []);
        const exact = result.find(id => mapping.attributes.externalSite === 'anilist/anime' ? id === `anilist:${numeric}` : nodes[id].aliases?.includes(`mal:${numeric}`));
        if (exact) nodes[exact].aliases = [...new Set([...(nodes[exact].aliases || []), key])];
        await pause(1200);
      }
      report(1);
    }
    for (let i = 0; i < aniIds.length; i += 40) { await aniBatch(aniIds.slice(i, i + 40)); report(Math.min(40, aniIds.length - i)); persist(); await pause(1200); }
    for (let i = 0; i < vnIds.length; i += 40) { await vnBatch(vnIds.slice(i, i + 40)); report(Math.min(40, vnIds.length - i)); persist(); await pause(500); }
    // Pull a bounded second hop toward source/prequel roots, not an unbounded crawl.
    const roots = [...new Set(keys.flatMap(key => (find(key)?.relations || []).filter(r => ['PREQUEL', 'SOURCE', 'PARENT'].includes(r.type)).map(r => r.key)))].filter(k => /^anilist:\d+$/.test(k) && !fresh(k)).slice(0, 120);
    for (let i = 0; i < roots.length; i += 40) { await aniBatch(roots.slice(i, i + 40).map(k => Number(k.slice(8)))); persist(); await pause(1200); }
    persist(); onProgress?.({ done: keys.filter(key => fresh(find(key)?.key || key)).length, total }); return { ...nodes };
  };
  // Serialize background scans so navigating between public profiles cannot flood providers.
  const promise = queue.then(work);
  queue = promise.then(() => undefined, () => undefined);
  jobs.set(jobKey, promise);
  promise.finally(() => jobs.delete(jobKey)).catch(() => {});
  return promise;
}
