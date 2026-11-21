import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDownWideNarrow, Clock3, Globe, Monitor, RotateCcw, Search, X } from 'lucide-react';
import { browseVns, VN_FILTER_DEFAULTS, VN_LANGUAGES, VN_LENGTHS, VN_MOODS, VN_PLATFORMS } from '../services/vndb';
import { CatalogueFilter } from './CatalogueFilter';

type BrowseResult = Awaited<ReturnType<typeof browseVns>>;
type Novel = BrowseResult['items'][number];
const grid = 'grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
const optionList = (empty: string, values: Record<string, string>) => [{ value: '', label: empty }, ...Object.entries(values).map(([value, label]) => ({ value, label }))];
const durations = optionList('Any length', VN_LENGTHS);
const languages = optionList('Any language', VN_LANGUAGES);
const platforms = optionList('Any platform', VN_PLATFORMS);

export function VnDiscovery({ onSelect, renderTile, renderSkeleton }: {
  onSelect: (novel: Novel) => void;
  renderTile: (novel: Novel, open: () => void) => ReactNode;
  renderSkeleton: () => ReactNode;
}) {
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
  const setSearch = (value: string) => { setQuery(value); setPage(1); setError({ key: '', page: 0, message: '' }); };
  const filtered = Boolean(search || Object.entries(options).some(([name, value]) => value !== VN_FILTER_DEFAULTS[name]));
  return <section aria-label="Visual novel catalogue" className="min-w-0 space-y-5">
    <div className="relative z-40 space-y-3.5">
      <div className="flex items-center gap-2.5">
        <div className="group relative min-w-0 flex-1">
          <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-500 group-focus-within:text-white" />
          <input aria-label="Search visual novels" type="search" placeholder="Search visual novels..." value={query} maxLength={100} onChange={event => setSearch(event.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-10 text-sm text-white backdrop-blur-sm transition-colors placeholder:text-gray-500 hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 [&::-webkit-search-cancel-button]:appearance-none" />
          {query && <button type="button" aria-label="Clear title search" title="Clear title search" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"><X size={15} /></button>}
        </div>
        <button type="button" onClick={reset} disabled={!filtered} aria-label="Reset filters" title="Reset filters" className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-gray-200 transition-colors hover:bg-white/10 disabled:opacity-35"><RotateCcw size={17} /></button>
      </div>
      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto p-1 no-scrollbar" role="group" aria-label="Mood">
        <button type="button" aria-pressed={!options.mood} className={moodClass(!options.mood)} onClick={() => update('mood', '')}>Any mood</button>
        {Object.entries(VN_MOODS).map(([id, label]) => <button type="button" key={id} aria-pressed={options.mood === id} className={moodClass(options.mood === id)} onClick={() => update('mood', options.mood === id ? '' : id)}>{label}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <CatalogueFilter icon={Clock3} label="Length" options={durations} value={options.length} onChange={value => update('length', value)} />
        <CatalogueFilter icon={Globe} label="Language" options={languages} value={options.language} onChange={value => update('language', value)} />
        <CatalogueFilter icon={Monitor} label="Platform" options={platforms} value={options.platform} onChange={value => update('platform', value)} />
        <CatalogueFilter icon={ArrowDownWideNarrow} label="Sort" options={[{ value: 'popular', label: search ? 'Best match' : 'Most voted' }, { value: 'rated', label: 'Top rated' }, { value: 'newest', label: 'Recently released' }]} value={options.sort} onChange={value => update('sort', value)} />
      </div>
    </div>
    <div className="home-results-bar">
      <span role="status">{loading && !current ? 'Loading visual novels…' : current?.items.length ? `${current.items.length} titles` : 'Visual novels'}</span>
      <a href="https://vndb.org" target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 text-gray-400 hover:text-white">VNDB</a>
    </div>
    {failure && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-amber-300/70 bg-white/5 p-3 text-sm text-gray-200">{failure}<button type="button" className="min-h-9 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15" onClick={() => { setError({ key: '', page: 0, message: '' }); setRetry(value => value + 1); }}>Retry</button></div>}
    {loading && !current && <div aria-hidden="true" className={grid}>{Array.from({ length: 6 }, (_, index) => <div key={index}>{renderSkeleton()}</div>)}</div>}
    {current && !current.items.length && !loading && !failure && <div className="py-12 text-center"><p className="font-semibold text-white">No matching visual novels</p><button type="button" onClick={reset} className="mt-3 rounded-lg px-3 py-2 text-sm text-cyan-200 hover:bg-white/10">Clear filters</button></div>}
    {current && current.items.length > 0 && <div className={grid}>
      {current.items.map(novel => <div key={novel.id} className="min-w-0">{renderTile(novel, () => onSelect(novel))}</div>)}
    </div>}
    {current?.more && <div className="flex justify-center"><button type="button" disabled={loading || !!failure} className="min-h-10 rounded-lg border border-white/15 px-4 text-sm font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-45" onClick={() => setPage(value => value + 1)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
  </section>;
}

const moodClass = (active: boolean) => `min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${active ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`;
