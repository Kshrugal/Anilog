import { safeArtwork, type ShowcaseItem } from './profile-identity';
import { profileMediaId, profileIsVn } from './profile';

export type Artwork = ShowcaseItem & { banner?: string };
export async function profileCast(media: Artwork, signal: AbortSignal): Promise<Artwork[]> {
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  if (media.source === 'vndb' && media.kind === 'vn') {
    const id = media.id.split(':')[1];
    const response = await fetch('https://api.vndb.org/kana/character', { method: 'POST', signal: timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: ['vn', '=', ['id', '=', id]], fields: 'name,image.url,image.sexual,image.violence,vns.id,vns.spoiler', results: 50, sort: 'name' }) });
    if (!response.ok) throw new Error('Character artwork could not be loaded.');
    const data = await response.json();
    return (data.results || []).filter(item => item.image && item.image.sexual < 1 && item.image.violence < 1 && safeArtwork(item.image.url) && item.vns?.some(vn => vn.id === id && vn.spoiler === 0)).map(item => ({ id: `vndb:${item.id}`, title: item.name, imageUrl: item.image.url, source: 'vndb', kind: 'characters' }));
  }
  if (media.source !== 'anilist' || media.kind !== 'anime') return [];
  const response = await fetch('https://graphql.anilist.co', { method: 'POST', signal: timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query($id:Int!){Media(id:$id,type:ANIME){characters(perPage:24,sort:[ROLE,RELEVANCE]){nodes{id name{full} image{large}}}}}', variables: { id: Number(media.id.split(':')[1]) } }) });
  const data = await response.json();
  if (!response.ok || data.errors) throw new Error('Character artwork could not be loaded.');
  return (data.data?.Media?.characters?.nodes || []).filter(item => safeArtwork(item.image?.large)).map(item => ({ id: `anilist:${item.id}`, title: item.name.full, imageUrl: item.image.large, source: 'anilist', kind: 'characters' }));
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
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  if (kind === 'vn' || (kind === 'characters' && source === 'vndb')) {
    const character = kind === 'characters';
    const response = await fetch(`https://api.vndb.org/kana/${character ? 'character' : 'vn'}`, { method: 'POST', signal: timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: ['search', '=', text], fields: `${character ? 'name' : 'title'},image.url,image.sexual,image.violence`, results: 16, sort: 'searchrank' }) });
    if (!response.ok) throw new Error('VNDB search is unavailable. Try again shortly.');
    const data = await response.json();
    return (data.results || []).filter(item => item.image && item.image.sexual < 1 && item.image.violence < 1 && safeArtwork(item.image.url)).map(item => ({ id: `vndb:${item.id}`, title: String(item.name || item.title).slice(0, 200), imageUrl: item.image.url, source: 'vndb', kind }));
  }
  const character = kind === 'characters';
  const fields = character ? 'characters(search:$search){ id name{full} image{large} }' : 'media(search:$search,type:ANIME,isAdult:false){ id title{english romaji} coverImage{large} bannerImage }';
  const response = await fetch('https://graphql.anilist.co', { method: 'POST', signal: timeout, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query($search:String){Page(perPage:16){${fields}}}`, variables: { search: text } }) });
  const data = await response.json();
  if (!response.ok || data.errors) throw new Error('AniList search is unavailable. Try again shortly.');
  return (data.data?.Page?.[character ? 'characters' : 'media'] || []).map(item => ({ id: `anilist:${item.id}`, title: String(character ? item.name.full : item.title.english || item.title.romaji).slice(0, 200), imageUrl: character ? item.image.large : item.coverImage.large, ...(item.bannerImage && safeArtwork(item.bannerImage) ? { banner: item.bannerImage } : {}), source: 'anilist', kind })).filter(item => safeArtwork(item.imageUrl));
}
