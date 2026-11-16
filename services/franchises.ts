export type Relation = { key: string; type: string; official?: boolean };
export type CatalogueNode = { key: string; title: string; type?: string; titles?: string[]; aliases?: string[]; relations?: Relation[]; creators?: { id?: string; name: string; role: string }[]; developers?: { id: string; name: string }[]; year?: number; fetchedAt?: number; cachedAt?: number };
export type Catalogue = Record<string, CatalogueNode>;
export type Membership = { franchise: string; franchiseKey: string; universe: string; universeKey: string; basis: string; source: string; confidence: 'catalogue' | 'reviewed' | 'title' | 'unresolved'; creators: string[] };
type Family = { id: string; name: string; aliases: string[]; universe?: string; source?: string };
const TYPE_MOON_SOURCE = 'https://www.typemoon.com/products/';

// These are identity aliases, not studio clusters. Provider relation graphs handle
// the long tail; this small reviewed layer joins cross-provider/renamed branches.
const families: Family[] = [
  { id: 'naruto', name: 'Naruto', aliases: ['naruto', 'boruto', 'rock lee no seishun', 'road of naruto', 'ナルト', '火影忍者'] },
  { id: 'bleach', name: 'Bleach', aliases: ['bleach', 'ブリーチ'] },
  { id: 'fate', name: 'Fate', aliases: ['fate stay night', 'fate zero', 'fate grand', 'fate extra', 'fate extella', 'fate hollow', 'fate kaleid', 'fate strange', 'fate prototype', 'fate apocrypha', 'fate samurai', 'fate requiem', 'fate lost', 'fate type redline', 'lord el melloi', 'todays menu for the emiya family', 'emiya san chi no kyou no gohan', 'fate carnival'], universe: 'TYPE-MOON', source: TYPE_MOON_SOURCE },
  { id: 'tsukihime', name: 'Tsukihime', aliases: ['tsukihime', 'shingetsutan tsukihime', 'melty blood', 'kagetsu tohya', 'kagetsu tooya', '月姫', '歌月十夜'], universe: 'TYPE-MOON', source: TYPE_MOON_SOURCE },
  { id: 'garden-of-sinners', name: 'The Garden of Sinners', aliases: ['the garden of sinners', 'garden of sinners', 'kara no kyoukai', 'kara no kyokai', '空の境界'], universe: 'TYPE-MOON', source: TYPE_MOON_SOURCE },
  { id: 'mahoyo', name: 'Witch on the Holy Night', aliases: ['witch on the holy night', 'mahoutsukai no yoru', 'mahou tsukai no yoru', '魔法使いの夜'], universe: 'TYPE-MOON', source: TYPE_MOON_SOURCE },
  { id: 'type-moon-crossovers', name: 'TYPE-MOON Crossovers', aliases: ['carnival phantasm', 'take moon', 'all around type moon'], universe: 'TYPE-MOON', source: TYPE_MOON_SOURCE },
  { id: 'one-piece', name: 'One Piece', aliases: ['one piece', 'ワンピース'] },
  { id: 'dragon-ball', name: 'Dragon Ball', aliases: ['dragon ball', 'ドラゴンボール'] },
  { id: 'monogatari', name: 'Monogatari', aliases: ['bakemonogatari', 'nisemonogatari', 'nekomonogatari', 'kizumonogatari', 'hanamonogatari', 'tsukimonogatari', 'koyomimonogatari', 'owarimonogatari', 'zoku owarimonogatari', 'monogatari series', '化物語', '傷物語', '物語シリーズ'] },
  { id: 'attack-on-titan', name: 'Attack on Titan', aliases: ['attack on titan', 'shingeki no kyojin', '進撃の巨人'] },
  { id: 'demon-slayer', name: 'Demon Slayer', aliases: ['demon slayer', 'kimetsu no yaiba', '鬼滅の刃'] },
  { id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', aliases: ['jujutsu kaisen', '呪術廻戦'] },
  { id: 'steins-gate', name: 'Steins;Gate', aliases: ['steins gate', 'シュタインズ ゲート'] },
  { id: 're-zero', name: 'Re:ZERO', aliases: ['re zero', 'rezero', 're ゼロから始める異世界生活'] },
  { id: 'haruhi', name: 'Haruhi Suzumiya', aliases: ['the melancholy of haruhi suzumiya', 'the disappearance of haruhi suzumiya', 'suzumiya haruhi', '涼宮ハルヒ'] },
  { id: 'toaru', name: 'A Certain Magical Index', aliases: ['a certain magical index', 'a certain scientific railgun', 'a certain scientific accelerator', 'toaru majutsu', 'toaru kagaku', 'とある魔術', 'とある科学'] },
  { id: 'snafu', name: 'My Teen Romantic Comedy SNAFU', aliases: ['my teen romantic comedy snafu', 'yahari ore no seishun', 'oregairu'] },
  { id: 'bunny-girl', name: 'Rascal Does Not Dream', aliases: ['rascal does not dream', 'seishun buta yarou'] },
];
const reviewedIds: Record<string, string> = { 'anilist:20': 'naruto', 'anilist:1735': 'naruto', 'anilist:30011': 'naruto', 'anilist:269': 'bleach', 'anilist:30012': 'bleach', 'anilist:116674': 'bleach', v11: 'fate', v7: 'tsukihime', v17909: 'tsukihime' };
const nodeFamily = (node: CatalogueNode) => families.find(f => f.id === reviewedIds[node.key]) || familyFor([node.title, ...(node.titles || [])]);

export const normalizeIdentity = (title: unknown) => String(title || '').normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const identityRules = families.map(family => ({ family, aliases: family.aliases.map(normalizeIdentity) }));
const boundaryMatch = (title: string, alias: string) => title === alias || title.startsWith(`${alias} `) || (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(alias) && title.startsWith(alias));
export function familyFor(titles: string[]) {
  if (titles.some(t => /[×✕]|\bvs\.?\s|\bcrossover\b/i.test(t))) return null;
  const normalized = titles.map(normalizeIdentity);
  for (const { family, aliases } of identityRules) if (normalized.some(title => aliases.some(alias => boundaryMatch(title, alias)))) return family;
  return null;
}

export function mediaKey(entry: Record<string, any>) {
  const id = String(entry.kitsuId || entry.vnId || entry.id || '');
  if (/^(anilist:|v\d|kitsu:|mal:)/.test(id)) return id;
  if (entry.provider === 'anilist' && /^\d+$/.test(id)) return `anilist:${id}`;
  if (entry.provider === 'vndb' && /^\d+$/.test(id)) return `v${id}`;
  if (entry.anilistId || entry.attributes?.anilistId) return `anilist:${entry.anilistId || entry.attributes.anilistId}`;
  return /^\d+$/.test(id) ? `kitsu:${id}` : `local:${id || normalizeIdentity(entry.title)}`;
}

export function titleFallback(title: unknown) {
  const original = String(title || '').trim();
  return original.replace(/(?:\s*[:\-–]?\s*)(?:the final season|final season|(?:season|part|cour)\s*\d+|\d+(?:st|nd|rd|th)\s+season)(?:\s.*)?$/i, '').replace(/\s+(?:II|III|IV|V|VI)$/, '').trim() || original || 'Untitled';
}
const franchiseRelations = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SUMMARY', 'SPIN_OFF', 'SOURCE', 'ADAPTATION', 'COMPILATION', 'ALTERNATIVE']);
const vnRelations: Record<string, string> = { preq: 'PREQUEL', seq: 'SEQUEL', side: 'SIDE_STORY', par: 'PARENT', orig: 'SOURCE', ser: 'SEQUEL', fan: 'SIDE_STORY', alt: 'ALTERNATIVE', set: 'SAME_UNIVERSE' };
export const relationKind = (relation: Relation) => vnRelations[relation.type] || relation.type.toUpperCase();
export const sourceUrl = (key: string, type = 'ANIME') => key.startsWith('anilist:') ? `https://anilist.co/${type === 'MANGA' ? 'manga' : 'anime'}/${key.slice(8)}` : /^v\d+$/.test(key) ? `https://vndb.org/${key}` : key.startsWith('kitsu:') ? `https://kitsu.app/anime/${key.slice(6)}` : '';

class Components {
  parent = new Map<string, string>();
  root(key: string): string { const parent = this.parent.get(key); if (!parent) { this.parent.set(key, key); return key; } if (parent === key) return key; const root = this.root(parent); this.parent.set(key, root); return root; }
  join(a: string, b: string) { const x = this.root(a), y = this.root(b); if (x !== y) { const root = x < y ? x : y; this.parent.set(y, root); this.parent.set(x, root); } }
}

export function resolveMemberships(entries: Record<string, any>[], catalogue: Catalogue = {}): Record<string, Membership> {
  const nodes: Catalogue = {};
  const identity = new Map<string, string>();
  for (const node of Object.values(catalogue)) { nodes[node.key] = node; identity.set(node.key, node.key); for (const alias of node.aliases || []) identity.set(alias, node.key); }
  for (const entry of entries) {
    const key = identity.get(mediaKey(entry)) || mediaKey(entry);
    const savedTitles = [entry.title, entry.canonicalTitle, ...Object.values(entry.titles || entry.attributes?.titles || {})].filter((v): v is string => typeof v === 'string' && !!v);
    const saved = nodes[key];
    nodes[key] = { ...saved, key, title: saved?.title || savedTitles[0] || 'Untitled', titles: [...(saved?.titles || []), ...savedTitles], creators: saved?.creators || entry.creators || [], developers: saved?.developers || entry.developers || [] };
  }
  const franchise = new Components(), universe = new Components();
  const matched = new Map<string, Family>();
  const initialFamilies = new Map(Object.values(nodes).map(node => [node.key, nodeFamily(node)]));
  for (const node of Object.values(nodes)) {
    const family = initialFamilies.get(node.key);
    const familyRelations = (node.relations || []).filter(r => family && initialFamilies.get(identity.get(r.key) || r.key)?.id === family.id);
    const unofficialDerivative = /^v\d+$/.test(node.key) && familyRelations.length && familyRelations.every(r => r.official === false);
    if (family && (!unofficialDerivative || reviewedIds[node.key])) matched.set(node.key, family);
    franchise.root(node.key); universe.root(node.key);
  }
  // Family labels deliberately join anime, manga and VN records: type is not an identity boundary.
  for (const [key, family] of matched) { franchise.join(key, `family:${family.id}`); universe.join(key, `universe:${family.universe || family.id}`); }
  const componentFamilies = new Map<string, Set<string>>();
  for (const [key, family] of matched) { const root = franchise.root(key); componentFamilies.set(root, new Set([...(componentFamilies.get(root) || []), family.id])); }
  const joinFranchise = (a: string, b: string) => {
    const left = franchise.root(a), right = franchise.root(b);
    const labels = new Set([...(componentFamilies.get(left) || []), ...(componentFamilies.get(right) || [])]);
    // Protect the entire connected component, not only the two immediate endpoints.
    if (labels.size > 1) return false;
    franchise.join(a, b);
    componentFamilies.delete(left); componentFamilies.delete(right);
    componentFamilies.set(franchise.root(a), labels);
    return true;
  };
  const evidence = new Map<string, string[]>();
  for (const node of Object.values(nodes)) {
    for (const relation of node.relations || []) {
      if (relation.official === false) continue;
      const target = identity.get(relation.key) || relation.key;
      const kind = relationKind(relation);
      // Character cameos and generic OTHER edges are never franchise evidence.
      if (franchiseRelations.has(kind) && joinFranchise(node.key, target)) {
        universe.join(node.key, target);
        for (const key of [node.key, target]) evidence.set(key, [...(evidence.get(key) || []), kind.toLowerCase().replaceAll('_', ' ')]);
      } else if (kind === 'SAME_UNIVERSE') universe.join(node.key, target);
    }
    // An exact producer identity can establish a reviewed umbrella, never a specific series.
    if (node.developers?.some(d => ['p6', 'p10689'].includes(d.id) || normalizeIdentity(d.name) === 'type moon')) universe.join(node.key, 'universe:TYPE-MOON');
  }
  // General cross-provider bridge: an exact, unambiguous title alias AND an
  // original-work credit must agree. A shared studio or creator alone is insufficient.
  const credits = (node: CatalogueNode) => new Set([...(node.creators || []).filter(c => /^(original (creator|story)|author|story(?:\s*&\s*art)?|scenario)$/i.test(c.role)).map(c => c.name), ...(node.developers || []).map(d => d.name)].map(name => normalizeIdentity(name).split(' ').sort().join(' ')).filter(Boolean));
  const aliases = new Map<string, CatalogueNode[]>();
  for (const node of Object.values(nodes)) {
    if (!node.fetchedAt || !credits(node).size) continue;
    for (const title of new Set([node.title, ...(node.titles || [])].map(normalizeIdentity).filter(t => t.length >= 5))) aliases.set(title, [...(aliases.get(title) || []), node]);
  }
  for (const candidates of aliases.values()) {
    const ani = candidates.filter(n => n.key.startsWith('anilist:'));
    const vns = candidates.filter(n => /^v\d+$/.test(n.key));
    if (new Set(ani.map(n => franchise.root(n.key))).size !== 1 || new Set(vns.map(n => franchise.root(n.key))).size !== 1) continue;
    for (const a of ani) for (const b of vns) {
      const left = matched.get(a.key), right = matched.get(b.key);
      if (left && right && left.id !== right.id) continue;
      const originalCredits = credits(b);
      if (![...credits(a)].some(name => originalCredits.has(name))) continue;
      if (!joinFranchise(a.key, b.key)) continue;
      universe.join(a.key, b.key);
      for (const key of [a.key, b.key]) evidence.set(key, [...(evidence.get(key) || []), 'cross-provider identity: exact alias and original credit']);
    }
  }
  const grouped = (components: Components) => {
    const result = new Map<string, CatalogueNode[]>();
    for (const node of Object.values(nodes)) { const root = components.root(node.key); result.set(root, [...(result.get(root) || []), node]); }
    return result;
  };
  const franchiseGroups = grouped(franchise), universeGroups = grouped(universe);
  const rootSupport = new Map<string, number>();
  for (const node of Object.values(nodes)) for (const relation of node.relations || []) {
    if (relation.official === false) continue;
    const weight = { SOURCE: 4, PARENT: 3, PREQUEL: 2 }[relationKind(relation)] || 0;
    const target = identity.get(relation.key) || relation.key;
    rootSupport.set(target, (rootSupport.get(target) || 0) + weight);
  }
  const canonical = (members: CatalogueNode[]) => {
    const reviewed = members.map(n => matched.get(n.key)).find(Boolean);
    if (reviewed) return reviewed.name;
    return [...members].sort((a, b) => (rootSupport.get(b.key) || 0) - (rootSupport.get(a.key) || 0) || (a.year || 9999) - (b.year || 9999) || titleFallback(a.title).length - titleFallback(b.title).length || a.key.localeCompare(b.key))[0]?.title || 'Untitled';
  };
  const results: Record<string, Membership> = {};
  for (const entry of entries) {
    const raw = mediaKey(entry), key = identity.get(raw) || raw, node = nodes[key];
    const members = franchiseGroups.get(franchise.root(key)) || [node];
    const universeMembers = universeGroups.get(universe.root(key)) || [node];
    const family = members.map(n => matched.get(n.key)).find(Boolean);
    const ownFamily = matched.get(key);
    const umbrella = universeMembers.map(n => matched.get(n.key)?.universe).find(Boolean) || (universe.root(key) === universe.root('universe:TYPE-MOON') ? 'TYPE-MOON' : null);
    const linked = members.length > 1 || evidence.has(key);
    const franchiseName = family?.name || (linked ? canonical(members) : titleFallback(node.title));
    const sharedCreators = (node.creators || []).filter(c => /^(original (creator|story)|author|story(?:\s*&\s*art)?|scenario)$/i.test(c.role)).map(c => c.name);
    const basis = evidence.get(key)?.length ? `Catalogue ${[...new Set(evidence.get(key))].join(', ')} relationship` : ownFamily ? `Reviewed ${ownFamily.name} title identity` : umbrella === 'TYPE-MOON' ? 'Exact TYPE-MOON developer identity' : linked ? 'Connected catalogue relationship path' : franchiseName !== node.title ? 'Title suffix fallback; not catalogue-confirmed' : 'No confirmed franchise relationship';
    results[String(entry.kitsuId || entry.id || '')] = {
      franchise: franchiseName, franchiseKey: family ? `family:${family.id}` : linked ? franchise.root(key) : `title:${entry.mediaType || (/^v\d/.test(raw) ? 'vn' : 'anime')}:${normalizeIdentity(franchiseName)}`,
      universe: umbrella || (universeMembers.length > members.length ? canonical(universeMembers) : franchiseName),
      universeKey: umbrella ? `universe:${umbrella}` : universeMembers.length > members.length ? universe.root(key) : family ? `family:${family.id}` : linked ? franchise.root(key) : `title:${entry.mediaType || (/^v\d/.test(raw) ? 'vn' : 'anime')}:${normalizeIdentity(franchiseName)}`,
      basis, source: ownFamily?.source || sourceUrl(key, node.type || (entry.mediaType === 'manga' ? 'MANGA' : 'ANIME')), confidence: evidence.has(key) ? 'catalogue' : ownFamily || umbrella ? 'reviewed' : linked ? 'catalogue' : franchiseName !== node.title ? 'title' : 'unresolved', creators: sharedCreators,
    };
  }
  return results;
}
