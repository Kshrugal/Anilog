import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { libraryArtwork, searchProfileArtwork, type Artwork } from '../services/profile-artwork';

export function ProfileArtworkPicker({ entries, kind: fixedKind, onSelect, selected = [] }: { entries: any[]; kind?: 'anime' | 'vn' | 'characters'; onSelect: (item: Artwork) => void; selected?: string[] }) {
  const [kind, setKind] = useState<'anime' | 'vn' | 'characters'>(fixedKind || 'anime');
  const [source, setSource] = useState<'anilist' | 'vndb'>('anilist');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>(null);
  useEffect(() => () => request.current?.abort(), []);
  function reset() { request.current?.abort(); setResults([]); setSearched(false); setLoading(false); setError(''); }
  async function search() {
    reset(); const controller = new AbortController(); request.current = controller; setLoading(true);
    try { const items = await searchProfileArtwork(query, kind, source, controller.signal); if (!controller.signal.aborted) { setResults(items); setSearched(true); } }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const local = entries.map(libraryArtwork).filter((item): item is Artwork => !!item && item.kind === kind && item.title.toLowerCase().includes(query.toLowerCase()));
  const items = searched ? results : local.slice(0, 16);
  return <div className="space-y-3">
    <div className="flex gap-2">{!fixedKind && <select aria-label="Artwork category" value={kind} onChange={e => { reset(); setKind(e.target.value as any); }} className="min-w-0 bg-[#161b25] border border-white/15 rounded p-2 text-xs"><option value="anime">Anime</option><option value="vn">Visual novels</option><option value="characters">Characters</option></select>}{kind === 'characters' && <select aria-label="Character catalogue" value={source} onChange={e => { reset(); setSource(e.target.value as any); }} className="min-w-0 bg-[#161b25] border border-white/15 rounded p-2 text-xs"><option value="anilist">AniList</option><option value="vndb">VNDB</option></select>}</div>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); search(); }}><input aria-label="Search profile artwork" placeholder={kind === 'characters' ? 'Search characters' : 'Search titles'} value={query} maxLength={100} onChange={e => { reset(); setQuery(e.target.value); }} className="min-w-0 w-full bg-black/20 border border-white/15 rounded p-2 text-sm" /><button aria-label="Search catalogue" title="Search catalogue" disabled={!query.trim() || loading} className="p-2 rounded bg-white/10 disabled:opacity-40"><Search size={18} /></button></form>
    {loading && <p role="status" className="text-xs text-gray-400">Searching…</p>}{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">{items.map(item => <button key={item.id} type="button" disabled={selected.includes(item.id)} title={item.title} aria-label={`Select ${item.title}`} onClick={() => onSelect(item)} className="min-w-0 text-left disabled:opacity-30 group"><img src={item.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full aspect-[2/3] object-cover rounded border border-white/10 group-hover:border-white/50" /><span className="text-[10px] line-clamp-2 mt-1">{item.title}</span></button>)}</div>
    {searched && !loading && !items.length && <p className="text-xs text-gray-500">No matching artwork.</p>}
  </div>;
}
