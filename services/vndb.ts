import { safeArtwork } from './profile-identity';

export const VN_MOODS = { g19: 'Mystery', g96: 'Romance', g7: 'Horror', g104: 'Comedy', g454: 'Slice of Life', g105: 'Science Fiction', g2: 'Fantasy', g147: 'Drama' };
export const VN_LANGUAGES = { en: 'English', ja: 'Japanese', 'zh-Hans': 'Simplified Chinese', 'zh-Hant': 'Traditional Chinese', ko: 'Korean', fr: 'French', es: 'Spanish', de: 'German', 'pt-br': 'Portuguese (Brazil)', ru: 'Russian' };
export const VN_PLATFORMS = { win: 'Windows', mac: 'macOS', lin: 'Linux', swi: 'Nintendo Switch', ps4: 'PlayStation 4', ps5: 'PlayStation 5', and: 'Android', ios: 'iOS', web: 'Browser' };
export const VN_LENGTHS = { 1: 'Very short', 2: 'Short', 3: 'Medium', 4: 'Long', 5: 'Very long' };
export const VN_FILTER_DEFAULTS = { mood: '', language: '', platform: '', length: '', sort: 'popular' };
type Filters = typeof VN_FILTER_DEFAULTS;
type Filter = [string, '=', unknown] | [string, '<=', string] | ['and', ...Filter[]];
export const VN_PAGE_SIZE = 24;
const API = 'https://api.vndb.org/kana/vn';
const IMAGE_FIELDS = 'image.url,image.thumbnail,image.sexual,image.violence,image.votecount';
const FIELDS = `title,alttitle,${IMAGE_FIELDS},rating,length,length_minutes,released,languages,platforms`;

export function vnBrowseRequest(term: string, options: Filters, page: number, today = new Date().toISOString().slice(0, 10)) {
  const filters: Filter[] = [];
  const search = term.trim().slice(0, 100);
  if (search) filters.push(['search', '=', search]);
  if (Object.hasOwn(VN_MOODS, options.mood)) filters.push(['tag', '=', [options.mood, 0, 1]]);
  if (Object.hasOwn(VN_LENGTHS, options.length)) filters.push(['length', '=', Number(options.length)]);
  const availability: Filter[] = [];
  if (Object.hasOwn(VN_LANGUAGES, options.language)) availability.push(['lang', '=', options.language]);
  if (Object.hasOwn(VN_PLATFORMS, options.platform)) availability.push(['platform', '=', options.platform]);
  if (availability.length) {
    filters.push(['release', '=', ['and', ...availability, ['rtype', '=', 'complete'], ['released', '<=', today]]]);
  }
  if (options.sort === 'newest') filters.push(['released', '<=', today]);
  const sort = options.sort === 'newest' ? 'released' : options.sort === 'rated' ? 'rating' : search ? 'searchrank' : 'votecount';
  return { filters: filters.length > 1 ? ['and', ...filters] : filters[0] || [], fields: FIELDS, sort, reverse: sort !== 'searchrank', results: VN_PAGE_SIZE, page };
}

export function vnCover(image: any, thumbnail = false) {
  if (typeof image?.votecount !== 'number' || image.votecount <= 0 ||
    typeof image.sexual !== 'number' || image.sexual < 0 || image.sexual >= 1 ||
    typeof image.violence !== 'number' || image.violence < 0 || image.violence >= 1) return '';
  const url = thumbnail && safeArtwork(image.thumbnail) ? image.thumbnail : image.url;
  return safeArtwork(url) ? url : '';
}

export function vnSynopsis(value: unknown) {
  if (typeof value !== 'string') return '';
  // An unmatched opening marker hides the rest instead of revealing the spoiler.
  let depth = 0;
  return value.split(/(\[\/?spoiler(?:=[^\]]*)?\])/gi).filter(part => {
    if (/^\[spoiler/i.test(part)) { depth++; return false; }
    if (/^\[\/spoiler/i.test(part)) { depth = Math.max(0, depth - 1); return false; }
    return !depth;
  }).join('').replace(/\[\/?(?:url|b|i|u|s|quote|raw)(?:=[^\]]*)?\]/gi, '').trim();
}

export function mapVnRecord(raw: any) {
  if (!/^v\d+$/.test(raw?.id)) return null;
  const title = String(raw.title || raw.alttitle || 'Untitled visual novel');
  const imageUrl = vnCover(raw.image, true);
  const poster = { original: vnCover(raw.image), large: imageUrl, medium: imageUrl, small: imageUrl };
  const minutes = typeof raw.length_minutes === 'number' && raw.length_minutes > 0 ? raw.length_minutes : 0;
  const rating = typeof raw.rating === 'number' && raw.rating > 0 && raw.rating <= 100 ? raw.rating : null;
  const synopsis = vnSynopsis(raw.description);
  const released = /^\d{4}/.test(raw.released) ? raw.released as string : '';
  const languages = Array.isArray(raw.languages) ? raw.languages.filter((value: string) => Object.hasOwn(VN_LANGUAGES, value)) as string[] : [];
  const platforms = Array.isArray(raw.platforms) ? raw.platforms.filter((value: string) => Object.hasOwn(VN_PLATFORMS, value)) as string[] : [];
  return {
    id: raw.id as string, kitsuId: raw.id as string, title, canonicalTitle: title, imageUrl, provider: 'vndb', mediaType: 'vn',
    totalEpisodes: 0, showType: 'Visual Novel', synopsis, posterImage: poster,
    rating, length: VN_LENGTHS[raw.length] || '', minutes, released, languages, platforms,
    attributes: { canonicalTitle: title, posterImage: poster, showType: 'Visual Novel', episodeCount: 0, estimatedLengthMinutes: minutes, averageRating: rating, synopsis, released, languages, platforms },
  };
}

async function queryVn(body: object, signal: AbortSignal) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'VNDB is busy. Give it a moment and retry.' : 'VNDB is unavailable. Try again in a moment.');
  return res.json();
}

const browseCache = new Map<string, { expires: number; data: Awaited<ReturnType<typeof loadBrowse>> }>();
async function loadBrowse(body: ReturnType<typeof vnBrowseRequest>, signal: AbortSignal) {
  const response = await queryVn(body, signal);
  if (!Array.isArray(response.results)) throw new Error('VNDB returned an unexpected response.');
  return { more: response.more === true, items: (response.results as any[]).map(mapVnRecord).filter(item => item !== null) };
}

export async function browseVns(term: string, options: Filters, page: number, signal: AbortSignal) {
  signal.throwIfAborted();
  const body = vnBrowseRequest(term, options, page);
  const key = JSON.stringify(body);
  const previous = browseCache.get(key);
  if (previous && previous.expires > Date.now()) return previous.data;
  const data = await loadBrowse(body, signal);
  if (browseCache.size >= 24) browseCache.delete(browseCache.keys().next().value);
  browseCache.set(key, { data, expires: Date.now() + 5 * 60_000 });
  return data;
}

export async function fetchVnDetails(id: string) {
  if (!/^v\d+$/.test(id)) throw new Error('Invalid VNDB title ID.');
  const data = await queryVn({ filters: ['id', '=', id], fields: `${FIELDS},description`, results: 1 }, AbortSignal.timeout(15_000));
  const vn = mapVnRecord(data.results?.[0]);
  if (!vn || vn.id !== id) throw new Error('Visual novel not found.');
  return vn;
}
