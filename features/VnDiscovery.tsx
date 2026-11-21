import { useEffect, useState } from 'react';
import { BookOpen, Clock, RotateCcw, Search, Star } from 'lucide-react';
import { browseVns, VN_FILTER_DEFAULTS, VN_LANGUAGES, VN_LENGTHS, VN_MOODS, VN_PLATFORMS } from '../services/vndb';

type BrowseResult = Awaited<ReturnType<typeof browseVns>>;
type Novel = BrowseResult['items'][number];
const selectClass = 'min-h-10 min-w-0 w-full rounded-lg border border-white/15 bg-[#12141b] px-2.5 py-2 text-sm text-white';

export function VnDiscovery({ onSelect }: { onSelect: (novel: Novel) => void }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState(VN_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<BrowseResult & { key: string; page: number }>({ key: '', page: 0, items: [], more: false });
  const [error, setError] = useState({ key: '', page: 0, message: '' });
  const search = query.trim();
  const key = JSON.stringify([search, options]);
  const current = result.key === key && result.page <= page ? result : null;
  const failure = error.key === key && error.page === page ? error.message : '';
  const loading = !failure && (!current || current.page < page);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await browseVns(search, options, page, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
        if (controller.signal.aborted) return;
        setResult(previous => {
          const prior = page > 1 && previous.key === key ? previous.items : [];
          const seen = new Set(prior.map(item => item.id));
          return { key, page, more: data.more, items: [...prior, ...data.items.filter(item => !seen.has(item.id) && seen.add(item.id))] };
        });
      } catch (err) {
        if (!controller.signal.aborted) setError({ key, page, message: err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'VNDB took too long to respond.' });
      }
    }, search && page === 1 ? 320 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, options, page, retry, search]);

  const update = (name: keyof typeof options, value: string) => {
    setPage(1); setError({ key: '', page: 0, message: '' });
    setOptions(previous => ({ ...previous, [name]: value }));
  };
  const reset = () => { setQuery(''); setOptions(VN_FILTER_DEFAULTS); setPage(1); setError({ key: '', page: 0, message: '' }); };
  const filter = (name: 'length' | 'language' | 'platform', title: string, choices: Record<string, string>, empty: string) => <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-300">
    {title}<select className={selectClass} value={options[name]} onChange={event => update(name, event.target.value)}>
      <option value="">{empty}</option>{Object.entries(choices).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
  return <section aria-label="Visual novel catalogue" className="space-y-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xl font-bold text-white">Visual novel catalogue</h2>
      <a href="https://vndb.org" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-cyan-200">Data from VNDB</a>
    </div>
    <div className="space-y-4 border-y border-white/10 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-[1_1_15rem]"><span className="sr-only">Search visual novels</span><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="search" placeholder="Title, alternate title, or release" value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setPage(1); setError({ key: '', page: 0, message: '' }); }} className="min-h-11 w-full rounded-lg border border-white/15 bg-white/5 py-2 pl-10 pr-3 text-sm text-white placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
        {(search || Object.entries(options).some(([name, value]) => value !== VN_FILTER_DEFAULTS[name])) && <button type="button" onClick={reset} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white"><RotateCcw size={14} />Reset</button>}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mood">
        <button type="button" aria-pressed={!options.mood} className={moodClass(!options.mood)} onClick={() => update('mood', '')}>Any mood</button>
        {Object.entries(VN_MOODS).map(([id, label]) => <button type="button" key={id} aria-pressed={options.mood === id} className={moodClass(options.mood === id)} onClick={() => update('mood', options.mood === id ? '' : id)}>{label}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {filter('length', 'Length', VN_LENGTHS, 'Any length')}{filter('language', 'Release language', VN_LANGUAGES, 'Any language')}{filter('platform', 'Release platform', VN_PLATFORMS, 'Any platform')}
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-300">Sort by<select className={selectClass} value={options.sort} onChange={event => update('sort', event.target.value)}>
          <option value="popular">{search ? 'Best match' : 'Most voted'}</option><option value="rated">Top rated</option><option value="newest">Recently released</option>
        </select></label>
      </div>
    </div>
    {failure && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-amber-300/70 bg-white/5 p-3 text-sm text-gray-200">{failure}<button type="button" className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15" onClick={() => { setError({ key: '', page: 0, message: '' }); setRetry(value => value + 1); }}>Retry</button></div>}
    {loading && !current && <div role="status" className="py-10 text-center text-sm text-gray-400">Loading visual novels…</div>}
    {current && !current.items.length && !loading && !failure && <div className="py-12 text-center"><p className="font-semibold text-white">No matching visual novels</p><button type="button" onClick={reset} className="mt-3 rounded-lg px-3 py-2 text-sm text-cyan-200 hover:bg-white/10">Clear filters</button></div>}
    {current && current.items.length > 0 && <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {current.items.map(novel => <button key={novel.id} type="button" className="group min-w-0 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" onClick={() => onSelect(novel)}>
        <span className="relative mb-2 grid aspect-[2/3] w-full place-items-center overflow-hidden rounded-lg border border-white/10 bg-[#171b24] transition-colors group-hover:border-cyan-200/50">
          {novel.imageUrl ? <img src={novel.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" /> : <BookOpen size={30} className="text-gray-500" />}
        </span>
        <span className="block min-h-10 line-clamp-2 break-words text-sm font-semibold leading-5 text-white group-hover:text-cyan-100">{novel.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-gray-400">
          {(novel.minutes > 0 || novel.length) && <span className="flex items-center gap-1"><Clock size={13} />{novel.minutes > 0 ? `~${Number((novel.minutes / 60).toFixed(1))}h` : novel.length}</span>}
          {novel.rating !== null && <span className="flex items-center gap-1"><Star size={13} className="text-amber-300" />{(novel.rating / 10).toFixed(1)}/10</span>}
        </span>
      </button>)}
    </div>}
    {current?.more && <div className="flex justify-center"><button type="button" disabled={loading || !!failure} className="min-h-10 rounded-lg border border-white/15 px-4 text-sm font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-45" onClick={() => setPage(value => value + 1)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
  </section>;
}

const moodClass = (active: boolean) => `min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${active ? 'border-cyan-200/40 bg-cyan-200/10 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:border-white/25 hover:text-white'}`;
