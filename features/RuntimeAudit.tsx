import React, { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { entryId, exactTime, visualNovel, type LibraryEntry, type timeFor } from '../services/analytics';

export function RuntimeAudit({ entries, times, onSelect }: { entries: LibraryEntry[]; times: Record<string, ReturnType<typeof timeFor>>; onSelect: (entry: LibraryEntry) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => entries.filter(entry => {
    const time = times[entryId(entry)];
    const matches = filter === 'all' || (filter === 'missing' ? time.unknown || (!visualNovel(entry) && !time.duration) : filter === 'films' ? time.film : !visualNovel(entry) && !time.film);
    return matches && String(entry.title || '').toLocaleLowerCase().includes(search.toLocaleLowerCase());
  }).sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))), [entries, times, search, filter]);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages - 1);
  return <section className="space-y-5">
    <div><h2 className="font-semibold">Runtime audit</h2><p className="text-xs text-gray-400 mt-2 leading-relaxed">Catalogue runtimes, counted progress, and the source for each listing. Series use the catalogue’s general per-episode duration; this is not a stopwatch log or an exact record of skipped credits.</p></div>
    <div className="flex flex-wrap gap-3"><label className="flex flex-1 items-center gap-2 min-w-0"><Search size={16} className="text-gray-500 shrink-0" /><input aria-label="Search runtime audit" placeholder="Search titles" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="min-w-0 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm" /></label><select aria-label="Runtime audit filter" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} className="rounded-lg border border-white/15 bg-[#10121b] px-3 py-2 text-sm"><option value="all">All listings</option><option value="missing">Missing time data</option><option value="films">Films</option><option value="series">Series & specials</option></select></div>
    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_7rem_7rem] gap-4 border-b border-white/10 pb-3 text-xs text-gray-500"><span>Title / Calculation</span><span className="text-right">Full listing runtime</span><span className="text-right">Counted time</span></div>
    <div className="divide-y divide-white/10">{rows.slice(current * 25, (current + 1) * 25).map(entry => {
      const time = times[entryId(entry)];
      const vn = visualNovel(entry);
      return <div key={entryId(entry)} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-x-4 gap-y-3 py-4">
        <div className="col-span-2 sm:col-span-1 min-w-0"><button onClick={() => onSelect(entry)} className="text-left text-sm font-medium text-white hover:text-cyan-200 break-words">{entry.title}</button><p className="text-xs text-gray-500 mt-1 break-words">{vn ? time.basis : time.duration ? `${time.episodes} × ${time.duration} min · ${time.source}${time.film ? ' · Film' : ' per episode'}` : 'Runtime not available; no 24-minute assumption'}</p>{time.sourceUrl && <a href={time.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300/80 mt-1">{time.source}<ExternalLink size={11} /></a>}</div>
        <div className="text-sm sm:text-right tabular-nums"><span className="block sm:hidden text-xs text-gray-500 mb-1">Full runtime</span>{vn ? <span className="text-gray-500">Not inferred</span> : time.fullMinutes !== null ? exactTime(time.fullMinutes) : <span className="text-amber-300 text-xs">Unavailable</span>}</div>
        <div className="text-sm text-right tabular-nums"><span className="block sm:hidden text-xs text-gray-500 mb-1">Counted time</span>{time.unknown ? <span className="text-amber-300 text-xs">{vn ? 'Not logged' : 'Unknown'}</span> : exactTime(time.minutes)}</div>
      </div>;
    })}</div>
    {!rows.length && <p className="text-sm text-gray-500 py-8">No matching listings.</p>}
    <div className="flex items-center justify-between border-t border-white/10 pt-4 gap-3 text-xs text-gray-500"><span>{rows.length ? `${current * 25 + 1}–${Math.min((current + 1) * 25, rows.length)} of ${rows.length}` : '0 listings'}</span><div className="flex items-center gap-3"><button aria-label="Previous runtime page" title="Previous page" disabled={!current} onClick={() => setPage(current - 1)} className="p-2 rounded hover:bg-white/5 disabled:opacity-30"><ChevronLeft size={17} /></button><span>{current + 1} / {pages}</span><button aria-label="Next runtime page" title="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="p-2 rounded hover:bg-white/5 disabled:opacity-30"><ChevronRight size={17} /></button></div></div>
  </section>;
}
