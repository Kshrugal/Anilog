import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, Check, BookOpen, Tv, Users, Library, Globe, Loader2 } from 'lucide-react';
import { getAnimeCast, libraryArtwork, searchProfileArtwork, type Artwork } from '../services/profile-artwork';

export function ArtworkGrid({ items, onSelect, selected = [], selectedImage = '', action = 'Select' }: { items: Artwork[]; onSelect: (item: Artwork) => void; selected?: string[]; selectedImage?: string; action?: string }) {
  return <div className="pie-artwork-grid">{items.map(item => {
    const chosen = selected.includes(item.id) || selectedImage === item.imageUrl;
    return <button key={item.id} type="button" disabled={selected.includes(item.id)} aria-pressed={chosen} title={item.title} aria-label={`${action} ${item.title}`} onClick={() => onSelect(item)} className={`pie-artwork ${chosen ? 'is-selected' : ''}`}>
      <span className="pie-artwork-image"><img src={item.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" />{chosen && <span className="pie-artwork-check"><Check size={13} /></span>}</span>
      <span className="pie-artwork-name">{item.title}</span>
    </button>;
  })}</div>;
}

export function ProfileArtworkPicker({ entries, kind: fixedKind, onSelect, selected = [], selectedImage = '' }: { entries: any[]; kind?: 'anime' | 'vn' | 'characters'; onSelect: (item: Artwork) => void; selected?: string[]; selectedImage?: string }) {
  const [kind, setKind] = useState<'anime' | 'vn' | 'characters'>(fixedKind || 'anime');
  const [source, setSource] = useState<'anilist' | 'vndb'>('anilist');
  const [characterSearch, setCharacterSearch] = useState<'name' | 'anime'>('name');
  const [cast, setCast] = useState<{ anime: Artwork; items: Artwork[]; nextPage: number | null } | null>(null);
  const [view, setView] = useState<'library' | 'catalogue'>(fixedKind === 'characters' ? 'catalogue' : 'library');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>(null);
  const byAnime = kind === 'characters' && characterSearch === 'anime';
  useEffect(() => () => request.current?.abort(), []);
  function backToTitles() { request.current?.abort(); setCast(null); setLoading(false); setError(''); }
  function reset() { backToTitles(); setResults([]); setSearched(false); }
  async function search() {
    if (!query.trim()) return;
    reset(); setView('catalogue');
    const controller = new AbortController(); request.current = controller; setLoading(true);
    try { const items = await searchProfileArtwork(query, byAnime ? 'anime' : kind, byAnime ? 'anilist' : source, controller.signal); if (!controller.signal.aborted) { setResults(items); setSearched(true); } }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function loadCast(anime: Artwork, page = 1) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (page === 1) setCast({ anime, items: [], nextPage: 1 });
    setError('');
    setLoading(true);
    try {
      const { items, hasNextPage } = await getAnimeCast(anime.id, page, controller.signal);
      if (controller.signal.aborted) return;
      setCast(previous => {
        const entries = new Map((previous?.items || []).map(item => [item.id, item]));
        for (const item of items) entries.set(item.id, item);
        return { anime, items: [...entries.values()], nextPage: hasNextPage ? page + 1 : null };
      });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the cast.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const seen = new Set<string>();
  const local = entries.map(libraryArtwork).filter((item): item is Artwork => {
    if (!item || item.kind !== kind || !item.title.toLowerCase().includes(query.toLowerCase()) || seen.has(item.id)) return false;
    seen.add(item.id); return true;
  });
  const items = cast?.items ?? (view === 'library' ? local : results);
  const choosingAnime = byAnime && !cast;
  const placeholder = byAnime ? 'Find an anime title...' : kind === 'characters' ? 'Find a character...' : view === 'library' ? 'Filter your library...' : 'Find a title...';
  return <div className="pie-picker">
    {!fixedKind && <div className="pie-segments" role="group" aria-label="Artwork category">{([['anime', 'Anime', Tv], ['vn', 'Visual novels', BookOpen], ['characters', 'Characters', Users]] as const).map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => { reset(); setKind(id); if (id === 'characters') setView('catalogue'); }}><Icon size={14} />{label}</button>)}</div>}
    <div className="pie-picker-toolbar"><div className="pie-source-tabs" role="group" aria-label="Artwork source">
      {kind !== 'characters' && <button type="button" aria-pressed={view === 'library'} onClick={() => { reset(); setView('library'); }}><Library size={14} />Your library</button>}
      {kind === 'characters' ? <>
        <button type="button" aria-pressed={!byAnime} onClick={() => { reset(); setCharacterSearch('name'); }}><Users size={14} />Character name</button>
        <button type="button" aria-pressed={byAnime} onClick={() => { reset(); setCharacterSearch('anime'); }}><Tv size={14} />Anime title</button>
      </> : <button type="button" aria-pressed={view === 'catalogue'} onClick={() => { reset(); setView('catalogue'); }}><Globe size={14} />Catalogue</button>}
    </div>{kind === 'characters' && !byAnime && <select aria-label="Character catalogue" value={source} onChange={e => { reset(); setSource(e.target.value as 'anilist' | 'vndb'); }}><option value="anilist">AniList</option><option value="vndb">VNDB</option></select>}</div>
    {!cast && <form className="pie-search" onSubmit={e => { e.preventDefault(); search(); }}><Search size={16} aria-hidden="true" /><input aria-label={byAnime ? 'Search anime titles' : 'Search profile artwork'} placeholder={placeholder} value={query} maxLength={100} onChange={e => { reset(); setQuery(e.target.value); }} /><button type="submit" aria-label="Search catalogue" title="Search catalogue" disabled={!query.trim() || loading}>{loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}</button></form>}
    {cast && <div className="mb-3 space-y-2">
      <button type="button" className="pie-text-action" onClick={backToTitles}><ArrowLeft size={14} aria-hidden="true" />Back to anime results</button>
      <h4 className="break-words text-sm font-semibold">{cast.anime.title} characters</h4>
    </div>}
    {error && <p role="alert" className="pie-error">{error}</p>}{loading && <p role="status" className="pie-muted">{cast ? 'Loading characters...' : 'Searching catalogue...'}</p>}
    <div className="pie-picker-results"><ArtworkGrid items={items} onSelect={choosingAnime ? item => loadCast(item) : onSelect} selected={choosingAnime ? [] : selected} selectedImage={choosingAnime ? '' : selectedImage} action={choosingAnime ? 'Browse cast of' : 'Select'} /></div>
    {!items.length && !loading && !error && <div className="pie-empty">{cast ? 'No characters with artwork found for this anime.' : view === 'library' ? 'No matching titles in your library.' : searched ? byAnime ? 'No matching anime titles.' : 'No matching artwork.' : byAnime ? 'Search for an anime to browse its cast.' : kind === 'characters' ? 'Search for a character.' : 'Search the catalogue.'}{view === 'library' && query.trim() && <button type="button" className="pie-text-action" onClick={search}>Search catalogue</button>}</div>}
    {cast?.nextPage && !loading && <button type="button" className="pie-text-action mt-3" onClick={() => loadCast(cast.anime, cast.nextPage!)}>{error ? 'Retry loading characters' : 'Load more characters'}</button>}
  </div>;
}

// Keep unchanged favorite-search results stable when adjacent settings change.
export const MemoProfileArtworkPicker = React.memo(ProfileArtworkPicker);
