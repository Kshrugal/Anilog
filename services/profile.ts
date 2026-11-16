export const PROFILE_STATUSES = ['all', 'watching', 'completed', 'planned', 'paused', 'dropped'];

export function profileMediaId(entry: any) {
  const id = String(entry.kitsuId || entry.vnId || entry.vndbId || entry.id || entry.attributes?.kitsuId || entry.attributes?.id || '');
  if (!/^\d+$/.test(id)) return id;
  const provider = entry.provider || entry.attributes?.provider;
  if (provider === 'anilist') return `anilist:${id}`;
  if (provider === 'vndb' || entry.vnId || entry.vndbId || entry.mediaType === 'vn' || entry.showType === 'Visual Novel' || entry.attributes?.showType === 'Visual Novel') return `v${id}`;
  return id;
}

export function profileIsVn(entry: any) {
  return entry.mediaType === 'vn' || entry.showType === 'Visual Novel' || entry.attributes?.showType === 'Visual Novel' || /^v\d+$/i.test(profileMediaId(entry));
}

export function profileStatus(status: string) {
  return ({ planning: 'planned', on_hold: 'paused', reading: 'watching' })[status] || status || 'planned';
}

export function profileEntry(entry: any) {
  const title = entry.title || entry.canonicalTitle || entry.attributes?.canonicalTitle || '';
  return {
    ...entry,
    title,
    canonicalTitle: entry.canonicalTitle || entry.attributes?.canonicalTitle || title,
    imageUrl: entry.imageUrl || entry.image || '',
    kitsuId: profileMediaId(entry),
    mediaType: profileIsVn(entry) ? 'vn' : 'anime',
    status: profileStatus(entry.status),
  };
}

export function profileSearch(value: unknown) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function updatedTime(value: any) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Date.parse(value) || 0;
}

export function profileLibrary(entries: any[], media = 'all', status = 'all', search = '', sort = 'updated') {
  const needle = profileSearch(search);
  const pool = entries.filter(entry => (media === 'all' || (profileIsVn(entry) ? 'vn' : 'anime') === media) &&
    (!needle || [entry.title, entry.canonicalTitle, entry.attributes?.canonicalTitle, ...Object.values(entry.titles || entry.attributes?.titles || {})].some(title => profileSearch(title).includes(needle))));
  const counts = Object.fromEntries(PROFILE_STATUSES.map(key => [key, key === 'all' ? pool.length : pool.filter(entry => profileStatus(entry.status) === key).length]));
  const title = (entry: any) => String(entry.title || entry.canonicalTitle || entry.attributes?.canonicalTitle || '');
  const items = pool.filter(entry => status === 'all' || profileStatus(entry.status) === status).sort((a, b) => {
    const difference = sort === 'title' ? title(a).localeCompare(title(b)) : sort === 'score' ? (Number(b.score) || 0) - (Number(a.score) || 0) : updatedTime(b.updatedAt) - updatedTime(a.updatedAt);
    return difference || title(a).localeCompare(title(b)) || profileMediaId(a).localeCompare(profileMediaId(b));
  });
  return { items, counts };
}

export function profileProgress(entry: any) {
  const vn = profileIsVn(entry);
  const total = vn ? 100 : Math.max(0, Number(entry.totalEpisodes || entry.episodeCount || entry.attributes?.episodeCount) || 0);
  const progress = Math.max(0, Number(entry.watchedEpisodes) || 0);
  const current = total ? Math.min(total, progress) : progress;
  return vn ? `${current}% read` : `${current} / ${total || '?'} eps`;
}
