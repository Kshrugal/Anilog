import { safeArtwork, type ShowcaseItem } from './profile-identity';
import { profileMediaId, profileIsVn } from './profile';

export type Artwork = ShowcaseItem;

async function requestAniListArtwork(query: string, variables: Record<string, unknown>, signal: AbortSignal) {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error('AniList search is unavailable. Try again shortly.');
  const payload = await response.json();
  if (payload.errors?.length) throw new Error('AniList search is unavailable. Try again shortly.');
  return payload.data;
}

function characterArtwork(item): Artwork | null {
  const title = item?.name?.full;
  const imageUrl = item?.image?.large;
  if (!Number.isSafeInteger(item?.id) || item.id <= 0 || typeof title !== 'string' || !title.trim() || !safeArtwork(imageUrl)) return null;
  return { id: `anilist:${item.id}`, title: title.slice(0, 200), imageUrl, source: 'anilist', kind: 'characters' };
}

export async function getAnimeCast(animeId: string, page: number, signal: AbortSignal) {
  if (!/^anilist:[1-9]\d*$/.test(animeId)) throw new Error('Choose an anime from AniList.');
  const data = await requestAniListArtwork(`query ($id: Int!, $page: Int!) {
    Media(id: $id, type: ANIME, isAdult: false) {
      characters(page: $page, perPage: 25, sort: [ROLE, FAVOURITES_DESC]) {
        pageInfo { hasNextPage }
        nodes { id name { full } image { large } }
      }
    }
  }`, { id: Number(animeId.slice('anilist:'.length)), page }, signal);
  const cast = data?.Media?.characters;
  const items = (cast?.nodes || []).map(characterArtwork).filter((item): item is Artwork => item !== null);
  return { items, hasNextPage: cast?.pageInfo?.hasNextPage === true };
}

export function libraryArtwork(entry: any): Artwork | null {
  const key = profileMediaId(entry);
  const source = key.startsWith('v') ? 'vndb' : key.startsWith('anilist:') ? 'anilist' : 'kitsu';
  const id = source === 'anilist' ? key : `${source}:${key.replace('kitsu:', '')}`;
  const imageUrl = entry.imageUrl || entry.image || '';
  if (!safeArtwork(imageUrl) || !/^(anilist|vndb|kitsu):[v]?\d+$/.test(id)) return null;
  return { id, title: String(entry.title || '').slice(0, 200), imageUrl, source, kind: profileIsVn(entry) ? 'vn' : 'anime' };
}
export async function searchProfileArtwork(query: string, kind: 'anime' | 'vn' | 'characters', source: 'anilist' | 'vndb', signal: AbortSignal): Promise<Artwork[]> {
  const text = query.trim().slice(0, 100);
  if (!text) return [];
  if (kind === 'vn' || (kind === 'characters' && source === 'vndb')) {
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
    const character = kind === 'characters';
    const response = await fetch(`https://api.vndb.org/kana/${character ? 'character' : 'vn'}`, { method: 'POST', signal: timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: ['search', '=', text], fields: `${character ? 'name' : 'title'},image.url,image.sexual,image.violence`, results: 16, sort: 'searchrank' }) });
    if (!response.ok) throw new Error('VNDB search is unavailable. Try again shortly.');
    const data = await response.json();
    return (data.results || []).filter(item => item.image && item.image.sexual < 1 && item.image.violence < 1 && safeArtwork(item.image.url)).map(item => ({ id: `vndb:${item.id}`, title: String(item.name || item.title).slice(0, 200), imageUrl: item.image.url, source: 'vndb', kind }));
  }
  const character = kind === 'characters';
  const fields = character ? 'characters(search:$search){ id name{full} image{large} }' : 'media(search:$search,type:ANIME,isAdult:false,sort:SEARCH_MATCH){ id title{english romaji} coverImage{large} }';
  const data = await requestAniListArtwork(`query($search:String){Page(perPage:16){${fields}}}`, { search: text }, signal);
  if (character) return (data?.Page?.characters || []).map(characterArtwork).filter((item): item is Artwork => item !== null);
  return (data?.Page?.media || []).filter(item => safeArtwork(item.coverImage?.large)).map(item => ({
    id: `anilist:${item.id}`, title: String(item.title?.english || item.title?.romaji || '').slice(0, 200),
    imageUrl: item.coverImage.large, source: 'anilist', kind,
  }));
}
