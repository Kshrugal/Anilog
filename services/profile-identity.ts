export const ACCENTS = { cyan: '#67e8f9', rose: '#fda4af', green: '#86efac', gold: '#fde68a', violet: '#c4b5fd' };
export const MODULES = ['bio', 'progress', 'anime', 'vn', 'characters', 'activity'] as const;
export type ShowcaseItem = { id: string; title: string; imageUrl: string; source: 'anilist' | 'vndb' | 'kitsu'; kind: 'anime' | 'vn' | 'characters' };
export type ProfileImage = { url: string; path: string; x: number; y: number; zoom: number };
export type ProfileIdentity = { version: 1; bio: string; accent: keyof typeof ACCENTS; mediaLayout?: 'combined' | 'separate'; bannerMode: 'collage' | 'image'; avatar: ProfileImage; banner: ProfileImage; modules: string[]; showcases: { anime: ShowcaseItem[]; vn: ShowcaseItem[]; characters: ShowcaseItem[] } };
export const emptyImage = (): ProfileImage => ({ url: '', path: '', x: 50, y: 50, zoom: 1 });
export const defaultIdentity = (): ProfileIdentity => ({ version: 1, bio: '', accent: 'cyan', bannerMode: 'collage', avatar: emptyImage(), banner: emptyImage(), modules: [...MODULES], showcases: { anime: [], vn: [], characters: [] } });
export function safeArtwork(url: string) {
  try { const parsed = new URL(url); return typeof url === 'string' && url.length <= 2048 && !parsed.username && !parsed.password && !parsed.port && parsed.protocol === 'https:' && ['s4.anilist.co', 's5.anilist.co', 't.vndb.org', 's.vndb.org', 'media.kitsu.app', 'media.kitsu.io', 'firebasestorage.googleapis.com'].includes(parsed.hostname); } catch { return false; }
}
export function validShowcaseId(id: string, source: string, kind: string) {
  return (source === 'anilist' && ['anime', 'characters'].includes(kind) && /^anilist:\d+$/.test(id)) ||
    (source === 'kitsu' && kind === 'anime' && /^kitsu:\d+$/.test(id)) ||
    (source === 'vndb' && ((kind === 'vn' && /^vndb:v\d+$/.test(id)) || (kind === 'characters' && /^vndb:c\d+$/.test(id))));
}
export function normalizeIdentity(value: any): ProfileIdentity {
  const defaults = defaultIdentity();
  const image = (v: any): ProfileImage => ({ url: safeArtwork(v?.url) ? v.url : '', path: typeof v?.path === 'string' ? v.path : '', x: Number.isFinite(v?.x) ? Math.max(0, Math.min(100, v.x)) : 50, y: Number.isFinite(v?.y) ? Math.max(0, Math.min(100, v.y)) : 50, zoom: Number.isFinite(v?.zoom) ? Math.max(1, Math.min(3, v.zoom)) : 1 });
  const showcases = Object.fromEntries(['anime', 'vn', 'characters'].map(kind => {
    const seen = new Set();
    return [kind, (Array.isArray(value?.showcases?.[kind]) ? value.showcases[kind] : []).filter(item => {
      if (!item || typeof item.id !== 'string' || !validShowcaseId(item.id, item.source, kind) || item.kind !== kind || typeof item.title !== 'string' || !item.title.trim() || !safeArtwork(item.imageUrl) || item.imageUrl.includes('firebasestorage.googleapis.com') || seen.has(item.id)) return false;
      seen.add(item.id); return true;
    }).slice(0, 8).map(item => ({ id: item.id, title: item.title.slice(0, 200), imageUrl: item.imageUrl, source: item.source, kind }))];
  })) as ProfileIdentity['showcases'];
  return { ...defaults, mediaLayout: value?.mediaLayout === 'combined' ? 'combined' : 'separate', bio: typeof value?.bio === 'string' ? value.bio.slice(0, 2000) : '', accent: Object.hasOwn(ACCENTS, value?.accent || '') ? value.accent : 'cyan', bannerMode: value?.bannerMode === 'image' ? 'image' : 'collage', avatar: image(value?.avatar), banner: image(value?.banner), modules: Array.isArray(value?.modules) ? [...new Set<string>(value.modules.filter((m: string) => MODULES.includes(m as any)))] : defaults.modules, showcases };
}
export function profileShowcase(identity: ProfileIdentity, module: string) {
  if (identity.mediaLayout === 'combined' && ['anime', 'vn'].includes(module)) {
    const first = identity.modules.find(value => value === 'anime' || value === 'vn');
    return { hidden: module !== first, title: 'Favorite media', items: [...(identity.modules.includes('anime') ? identity.showcases.anime : []), ...(identity.modules.includes('vn') ? identity.showcases.vn : [])] };
  }
  return { hidden: false, title: undefined, items: identity.showcases[module] || [] };
}
export function showcaseUrl(item: ShowcaseItem) {
  const id = item.id.split(':')[1];
  return item.source === 'vndb' ? `https://vndb.org/${id}` : item.source === 'kitsu' ? `https://kitsu.app/anime/${id}` : `https://anilist.co/${item.kind === 'characters' ? 'character' : 'anime'}/${id}`;
}
// Explicit public projection: never spread a private library document.
export const PUBLIC_LIBRARY_FIELDS = ['kitsuId', 'title', 'imageUrl', 'totalEpisodes', 'status', 'watchedEpisodes', 'score', 'favorite', 'repeatCount', 'startedAt', 'completedAt', 'genres', 'mediaType', 'showType', 'provider', 'anilistId', 'durationMinutes', 'updatedAt', 'vnPlaytimeHours'];
export function publicLibraryEntry(entry: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key of ['kitsuId', 'title', 'imageUrl', 'status', 'startedAt', 'completedAt', 'mediaType', 'showType', 'provider']) {
    if (typeof entry[key] === 'string') result[key] = entry[key].slice(0, key === 'imageUrl' ? 2048 : 500);
  }
  for (const key of ['totalEpisodes', 'watchedEpisodes', 'score', 'repeatCount', 'anilistId', 'durationMinutes', 'vnPlaytimeHours']) {
    if (typeof entry[key] === 'number' && Number.isFinite(entry[key])) result[key] = Math.max(0, entry[key]);
  }
  if (typeof entry.favorite === 'boolean') result.favorite = entry.favorite;
  if (Array.isArray(entry.genres)) result.genres = entry.genres.filter(value => typeof value === 'string').slice(0, 50).map(value => value.slice(0, 100));
  const updated = typeof entry.updatedAt?.toMillis === 'function' ? entry.updatedAt.toMillis() : entry.updatedAt;
  if (typeof updated === 'number' && Number.isFinite(updated)) result.updatedAt = updated;
  else if (typeof updated === 'string') result.updatedAt = updated.slice(0, 100);
  return result;
}
